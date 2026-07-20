import secrets
import string
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.security import hash_password
from app.models.api_log import ApiLog
from app.models.audit_log import AuditLog
from app.models.error_log import ErrorLog
from app.models.instructor_profile import InstructorProfile
from app.models.role import SA_INSTRUCTOR, Role
from app.models.user import User
from app.models.user_session import UserSession
from app.services import account_service


def _instructor_role(db: Session) -> Role:
    role = db.query(Role).filter(Role.name == SA_INSTRUCTOR).first()
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SA_INSTRUCTOR role is not seeded",
        )
    return role


def _temporary_password() -> str:
    # Guarantee every required password class instead of hoping a random token
    # happens to contain them all.
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    chars = [
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.digits),
        secrets.choice("!@#$%"),
        *(secrets.choice(alphabet) for _ in range(10)),
    ]
    secrets.SystemRandom().shuffle(chars)
    return "".join(chars)


def _audit(
    db: Session,
    actor: User,
    action: str,
    entity_id: int,
    ip: Optional[str],
    details: Optional[dict] = None,
) -> None:
    db.add(
        AuditLog(
            user_id=actor.id,
            action=action,
            entity_type="sa_instructor",
            entity_id=entity_id,
            details=details,
            ip_address=ip,
        )
    )


def _serialize(user: User) -> dict:
    profile = user.instructor_profile
    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "is_active": user.is_active,
        "force_password_reset": user.force_password_reset,
        "title": profile.title if profile else "IELTS Instructor",
        "bio": profile.bio if profile else None,
        "created_at": user.created_at,
    }


def _base_query(db: Session):
    role = _instructor_role(db)
    return (
        db.query(User)
        .options(joinedload(User.instructor_profile))
        .filter(User.role_id == role.id, User.institute_id.is_(None))
    )


def list_instructors(
    db: Session, search: Optional[str] = None, active: Optional[bool] = None
) -> list[dict]:
    query = _base_query(db)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.outerjoin(InstructorProfile).filter(
            or_(
                User.email.ilike(term),
                User.first_name.ilike(term),
                User.last_name.ilike(term),
                InstructorProfile.title.ilike(term),
            )
        )
    if active is not None:
        query = query.filter(User.is_active.is_(active))
    return [_serialize(user) for user in query.order_by(User.created_at.desc()).all()]


def get_instructor_or_404(db: Session, instructor_id: int) -> User:
    user = _base_query(db).filter(User.id == instructor_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instructor not found")
    return user


def create_instructor(
    db: Session,
    actor: User,
    *,
    email: str,
    first_name: str,
    last_name: str,
    title: str,
    bio: Optional[str],
    ip: Optional[str],
) -> dict:
    if db.query(User).filter(User.email == email).first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use")

    role = _instructor_role(db)
    temporary_password = _temporary_password()
    user = User(
        email=email,
        password_hash=hash_password(temporary_password),
        role_id=role.id,
        institute_id=None,
        first_name=first_name,
        last_name=last_name,
        is_active=True,
        force_password_reset=True,
    )
    db.add(user)
    db.flush()
    db.add(
        InstructorProfile(
            user_id=user.id,
            title=title,
            bio=bio,
        )
    )
    _audit(db, actor, "sa_instructor.create", user.id, ip, {"email": email})
    db.commit()
    user = get_instructor_or_404(db, user.id)
    result = _serialize(user)
    result["temporary_password"] = temporary_password
    return result


def update_instructor(
    db: Session,
    actor: User,
    instructor_id: int,
    *,
    email: Optional[str],
    first_name: Optional[str],
    last_name: Optional[str],
    title: Optional[str],
    bio: Optional[str],
    fields_set: set[str],
    ip: Optional[str],
) -> dict:
    user = get_instructor_or_404(db, instructor_id)
    if email is not None and email != user.email:
        if db.query(User).filter(User.email == email, User.id != user.id).first() is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use")
        user.email = email
    if first_name is not None:
        user.first_name = first_name
    if last_name is not None:
        user.last_name = last_name

    profile = user.instructor_profile
    if profile is None:
        profile = InstructorProfile(user_id=user.id)
    if title is not None:
        profile.title = title
    if "bio" in fields_set:
        profile.bio = bio

    db.add_all([user, profile])
    _audit(db, actor, "sa_instructor.update", user.id, ip, {"fields": sorted(fields_set)})
    db.commit()
    return _serialize(get_instructor_or_404(db, user.id))


def set_active(
    db: Session, actor: User, instructor_id: int, active: bool, ip: Optional[str]
) -> dict:
    user = get_instructor_or_404(db, instructor_id)
    user.is_active = active
    revoked = account_service.revoke_all_sessions(db, user.id) if not active else 0
    db.add(user)
    _audit(
        db,
        actor,
        "sa_instructor.reactivate" if active else "sa_instructor.deactivate",
        user.id,
        ip,
        {"sessions_revoked": revoked},
    )
    db.commit()
    return _serialize(get_instructor_or_404(db, user.id))


def reset_password(
    db: Session, actor: User, instructor_id: int, ip: Optional[str]
) -> str:
    user = get_instructor_or_404(db, instructor_id)
    temporary_password = _temporary_password()
    user.password_hash = hash_password(temporary_password)
    user.force_password_reset = True
    revoked = account_service.revoke_all_sessions(db, user.id)
    db.add(user)
    _audit(
        db,
        actor,
        "sa_instructor.reset_password",
        user.id,
        ip,
        {"sessions_revoked": revoked},
    )
    db.commit()
    return temporary_password


def delete_instructor(db: Session, actor: User, instructor_id: int, ip: Optional[str]) -> None:
    user = get_instructor_or_404(db, instructor_id)
    # Authored content is durable business history and Phase 3.2+ records use
    # the instructor as their owner. Preserve that attribution permanently.
    from app.models.course import Course
    from app.models.exam_module import ExamModule

    if (
        db.query(Course).filter(Course.created_by_id == user.id).count() > 0
        or db.query(ExamModule).filter(ExamModule.created_by_id == user.id).count() > 0
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This instructor owns assessment content and cannot be deleted; deactivate the account instead",
        )
    _audit(db, actor, "sa_instructor.delete", user.id, ip, {"email": user.email})

    # Preserve historical logs but detach their actor reference. Live sessions
    # and the role-specific profile have no value after account deletion.
    db.query(ApiLog).filter(ApiLog.user_id == user.id).update({"user_id": None})
    db.query(AuditLog).filter(AuditLog.user_id == user.id).update({"user_id": None})
    db.query(ErrorLog).filter(ErrorLog.user_id == user.id).update({"user_id": None})
    db.query(UserSession).filter(UserSession.user_id == user.id).delete()
    db.delete(user)
    db.commit()


def dashboard_summary(db: Session, actor: User) -> dict:
    from app.models.exam_module import ExamModule, ExamModuleAsset, ExamModuleQuestion

    profile = actor.instructor_profile
    completion_parts = [
        bool(actor.first_name),
        bool(actor.last_name),
        bool(actor.avatar_path),
        bool(profile and profile.title),
        bool(profile and profile.bio),
    ]
    completion = round(sum(completion_parts) / len(completion_parts) * 100)
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.user_id == actor.id)
        .order_by(AuditLog.created_at.desc())
        .limit(8)
        .all()
    )
    return {
        "profile_completion": completion,
        "content": {
            "modules": db.query(ExamModule).filter(ExamModule.created_by_id == actor.id).count(),
            "drafts": db.query(ExamModule).filter(
                ExamModule.created_by_id == actor.id, ExamModule.status == "draft"
            ).count(),
            "published": db.query(ExamModule).filter(
                ExamModule.created_by_id == actor.id, ExamModule.status == "published"
            ).count(),
            "questions": db.query(ExamModuleQuestion)
            .join(ExamModuleQuestion.part)
            .join(ExamModule)
            .filter(ExamModule.created_by_id == actor.id)
            .count(),
            "audio": db.query(ExamModuleAsset)
            .join(ExamModule)
            .filter(ExamModule.created_by_id == actor.id)
            .count(),
            **{
                module_type: db.query(ExamModule).filter(
                    ExamModule.created_by_id == actor.id,
                    ExamModule.module_type == module_type,
                ).count()
                for module_type in (
                    "reading",
                    "speaking",
                    "writing",
                    "listening",
                    "full_mock",
                    "final_test",
                )
            },
        },
        "grading": {"pending": 0, "in_progress": 0, "completed_today": 0},
        "recent_activity": [
            {
                "action": log.action,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ],
    }
