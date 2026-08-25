from datetime import datetime, timezone
import secrets
import string
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import case, func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.security import hash_password
from app.models.audit_log import AuditLog
from app.models.instructor_profile import InstructorProfile
from app.models.role import SA_INSTRUCTOR, Role
from app.models.user import User
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
        "title": profile.title if profile else "Language CERT Instructor",
        "bio": profile.bio if profile else None,
        "dob": user.dob,
        "phone_number": user.phone_number,
        "address": user.address,
        "avatar_path": user.avatar_path,
        "gender": user.gender,
        "created_at": user.created_at,
    }


def _base_query(db: Session):
    """Every read of an instructor goes through here, listings and lookups alike.

    That is why the retired filter lives at this level rather than on the list
    endpoint: a deleted account must not be findable by id either, or it stays
    editable through a URL that a browser tab still remembers.
    """
    role = _instructor_role(db)
    return (
        db.query(User)
        .options(joinedload(User.instructor_profile))
        .filter(
            User.role_id == role.id,
            User.institute_id.is_(None),
            User.deleted_at.is_(None),
        )
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
    dob: Optional[datetime] = None,
    phone_number: Optional[str] = None,
    address: Optional[str] = None,
    avatar_path: Optional[str] = None,
    gender: Optional[str] = None,
    ip: Optional[str],
) -> dict:
    email = account_service.ensure_user_credentials_available(db, email)

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
        dob=dob,
        phone_number=phone_number,
        address=address,
        avatar_path=avatar_path,
        gender=gender,
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
    account_service.send_account_credentials_email(db, user, temporary_password, role_label="Instructor")
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
    dob: Optional[datetime] = None,
    phone_number: Optional[str] = None,
    address: Optional[str] = None,
    avatar_path: Optional[str] = None,
    gender: Optional[str] = None,
    fields_set: set[str],
    ip: Optional[str],
) -> dict:
    user = get_instructor_or_404(db, instructor_id)
    if email is not None and account_service.normalize_email(email) != account_service.normalize_email(user.email):
        user.email = account_service.ensure_user_credentials_available(
            db, email, exclude_user_id=user.id
        )
    if first_name is not None:
        user.first_name = first_name
    if last_name is not None:
        user.last_name = last_name
    if dob is not None:
        user.dob = dob
    if phone_number is not None:
        user.phone_number = phone_number
    if address is not None:
        user.address = address
    if avatar_path is not None:
        user.avatar_path = avatar_path
    if gender is not None:
        user.gender = gender

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
    user.password_changed_at = datetime.now(timezone.utc)
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
    _audit(db, actor, "sa_instructor.delete", user.id, ip, {"email": user.email})

    # Two things this used to do are now wrong, both for the same reason.
    #
    # It refused to delete an instructor who had authored courses or modules,
    # telling the caller to deactivate instead. That guard existed because
    # removing the row would leave `created_by_id` pointing at nothing. Retiring
    # keeps the row, so the authorship still resolves and the objection is gone
    # - and "deactivate instead" is now a description of what this does anyway.
    #
    # It also nulled the actor reference on this account's API, audit and error
    # log rows. That was damage control for the same delete: the logs would
    # otherwise have blocked it. Doing it now would erase the record of what
    # this instructor did, which is the opposite of the point.
    account_service.soft_delete_user(db, user)
    db.commit()


def dashboard_summary(db: Session, actor: User) -> dict:
    from app.models.exam_module import ExamModule, ExamModuleAsset, ExamModuleQuestion
    from app.models.attempt import (
        ATTEMPT_GRADED,
        PART_GRADE_GRADED,
        QUEUE_CLAIMED,
        AttemptPartGrade,
        GradingQueueEntry,
        TestAttempt,
    )

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

    published_filters = (
        ExamModule.created_by_id == actor.id,
        ExamModule.status == "published",
        ExamModule.deleted_at.is_(None),
    )
    usage_rows = (
        db.query(
            ExamModule.id,
            ExamModule.title,
            ExamModule.module_type,
            func.count(func.distinct(TestAttempt.user_id)).label("learners"),
            func.count(TestAttempt.id).label("attempts"),
            func.sum(case((TestAttempt.status == ATTEMPT_GRADED, 1), else_=0)).label(
                "completed_attempts"
            ),
        )
        .outerjoin(TestAttempt, TestAttempt.module_id == ExamModule.id)
        .filter(*published_filters)
        .group_by(ExamModule.id, ExamModule.title, ExamModule.module_type)
        .order_by(func.count(func.distinct(TestAttempt.user_id)).desc(), ExamModule.title.asc())
        .all()
    )
    course_usage = []
    for row in usage_rows:
        attempts = int(row.attempts or 0)
        completed_attempts = int(row.completed_attempts or 0)
        course_usage.append(
            {
                "module_id": row.id,
                "title": row.title,
                "module_type": row.module_type,
                "learners": int(row.learners or 0),
                "attempts": attempts,
                "completed_attempts": completed_attempts,
                "completion_rate": round(completed_attempts / attempts * 100)
                if attempts
                else 0,
            }
        )

    unique_learners = (
        db.query(func.count(func.distinct(TestAttempt.user_id)))
        .join(ExamModule, TestAttempt.module_id == ExamModule.id)
        .filter(*published_filters)
        .scalar()
        or 0
    )
    total_attempts = sum(item["attempts"] for item in course_usage)
    completed_attempts = sum(item["completed_attempts"] for item in course_usage)
    courses_with_usage = sum(1 for item in course_usage if item["attempts"] > 0)

    graded_events = (
        db.query(
            AttemptPartGrade.attempt_id,
            func.max(AttemptPartGrade.graded_at).label("graded_at"),
        )
        .filter(
            AttemptPartGrade.grader_id == actor.id,
            AttemptPartGrade.status == PART_GRADE_GRADED,
            AttemptPartGrade.graded_at.is_not(None),
        )
        .group_by(AttemptPartGrade.attempt_id)
        .all()
    )
    now = datetime.now(timezone.utc)
    month_buckets = []
    for months_ago in range(5, -1, -1):
        total_months = now.year * 12 + now.month - 1 - months_ago
        year, month_index = divmod(total_months, 12)
        month = month_index + 1
        month_buckets.append(
            {
                "key": f"{year:04d}-{month:02d}",
                "label": datetime(year, month, 1).strftime("%b"),
                "value": 0,
            }
        )
    trend_by_key = {bucket["key"]: bucket for bucket in month_buckets}
    for event in graded_events:
        graded_at = event.graded_at
        key = f"{graded_at.year:04d}-{graded_at.month:02d}"
        if key in trend_by_key:
            trend_by_key[key]["value"] += 1

    completed_today = sum(1 for event in graded_events if event.graded_at.date() == now.date())
    completed_this_month = sum(
        1
        for event in graded_events
        if event.graded_at.year == now.year and event.graded_at.month == now.month
    )
    in_progress = (
        db.query(GradingQueueEntry)
        .filter(
            GradingQueueEntry.assigned_to_id == actor.id,
            GradingQueueEntry.status == QUEUE_CLAIMED,
        )
        .count()
    )

    return {
        "profile_completion": completion,
        "content": {
            "modules": db.query(ExamModule).filter(
                ExamModule.created_by_id == actor.id,
                ExamModule.status != "archived",
            ).count(),
            "drafts": db.query(ExamModule).filter(
                ExamModule.created_by_id == actor.id, ExamModule.status == "draft"
            ).count(),
            "published": db.query(ExamModule).filter(
                ExamModule.created_by_id == actor.id, ExamModule.status == "published"
            ).count(),
            "questions": db.query(ExamModuleQuestion)
            .join(ExamModuleQuestion.part)
            .join(ExamModule)
            .filter(ExamModule.created_by_id == actor.id, ExamModule.status != "archived")
            .count(),
            "audio": db.query(ExamModuleAsset)
            .join(ExamModule)
            .filter(ExamModule.created_by_id == actor.id, ExamModule.status != "archived")
            .count(),
            **{
                module_type: db.query(ExamModule).filter(
                    ExamModule.created_by_id == actor.id,
                    ExamModule.status != "archived",
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
        "grading": {
            "pending": 0,
            "in_progress": in_progress,
            "completed_today": completed_today,
            "completed_this_month": completed_this_month,
            "completed_total": len(graded_events),
        },
        "engagement": {
            "unique_learners": int(unique_learners),
            "total_attempts": total_attempts,
            "completed_attempts": completed_attempts,
            "courses_with_usage": courses_with_usage,
        },
        "course_usage": course_usage,
        "grading_trend": month_buckets,
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
