import csv
import io
import secrets
import string
from zipfile import BadZipFile
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from openpyxl import load_workbook
from openpyxl.utils.exceptions import InvalidFileException
from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.security import hash_password
from app.dependencies.limits import enforce_limit
from app.models.attempt import AttemptPartGrade, TestAttempt
from app.models.audit_log import AuditLog
from app.models.institute import Institute
from app.models.role import INST_INSTRUCTOR, STUDENT, SUPER_ADMIN, Role
from app.models.user import User
from app.models.user_device import UserDevice
from app.models.user_session import UserSession
from app.services import account_service, institute_service, subscription_service

MANAGED_ROLES = (INST_INSTRUCTOR, STUDENT)
MAX_IMPORT_ROWS = 1000
EMAIL_ADAPTER = TypeAdapter(EmailStr)


def _temporary_password() -> str:
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


def _require_institute(actor: User, scoped_institute_id: Optional[int] = None) -> int:
    if actor.role.name == SUPER_ADMIN:
        if scoped_institute_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An institute is required for this operation",
            )
        return scoped_institute_id
    if actor.institute_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not associated with an institute",
        )
    if scoped_institute_id is not None and scoped_institute_id != actor.institute_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    return actor.institute_id


def admin_permissions(actor: User) -> dict:
    if actor.institute is None:
        return institute_service.normalized_admin_permissions(None)
    return institute_service.normalized_admin_permissions(actor.institute.admin_permissions)


def require_admin_permission(actor: User, *permissions: str) -> None:
    if actor.role.name == SUPER_ADMIN:
        return
    granted = admin_permissions(actor)
    if not any(granted.get(permission, False) for permission in permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This activity has not been permitted by the Super Admin",
        )


def _audit(
    db: Session,
    actor: User,
    action: str,
    member_id: Optional[int],
    ip: Optional[str],
    details: Optional[dict] = None,
) -> None:
    db.add(
        AuditLog(
            user_id=actor.id,
            action=action,
            entity_type="institute_member",
            entity_id=member_id,
            details=details,
            ip_address=ip,
        )
    )


def _member_query(db: Session, institute_id: int):
    return (
        db.query(User)
        .options(joinedload(User.role))
        .join(Role, User.role_id == Role.id)
        .filter(User.institute_id == institute_id, Role.name.in_(MANAGED_ROLES))
    )


def serialize_member(user: User, metrics: Optional[dict] = None) -> dict:
    metrics = metrics or {}
    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role.name,
        "is_active": user.is_active,
        "force_password_reset": user.force_password_reset,
        "phone_number": user.phone_number,
        "address": user.address,
        "avatar_url": account_service.avatar_url_for(user),
        "deleted_at": user.deleted_at,
        "attempt_count": metrics.get("attempt_count", 0),
        "device_count": metrics.get("device_count", 0),
        "active_session_count": metrics.get("active_session_count", 0),
        "created_at": user.created_at,
    }


def _metrics_for_members(db: Session, member_ids: list[int]) -> dict[int, dict]:
    metrics = {
        member_id: {"attempt_count": 0, "device_count": 0, "active_session_count": 0}
        for member_id in member_ids
    }
    if not member_ids:
        return metrics

    for user_id, count in (
        db.query(TestAttempt.user_id, func.count(TestAttempt.id))
        .filter(TestAttempt.user_id.in_(member_ids))
        .group_by(TestAttempt.user_id)
        .all()
    ):
        metrics[user_id]["attempt_count"] = count
    for user_id, count in (
        db.query(UserDevice.user_id, func.count(UserDevice.id))
        .filter(UserDevice.user_id.in_(member_ids))
        .group_by(UserDevice.user_id)
        .all()
    ):
        metrics[user_id]["device_count"] = count
    now = datetime.now(timezone.utc)
    for user_id, count in (
        db.query(UserSession.user_id, func.count(UserSession.id))
        .filter(
            UserSession.user_id.in_(member_ids),
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > now,
        )
        .group_by(UserSession.user_id)
        .all()
    ):
        metrics[user_id]["active_session_count"] = count
    return metrics


def list_members(
    db: Session,
    actor: User,
    role_name: Optional[str] = None,
    search: Optional[str] = None,
    active: Optional[bool] = None,
    status_filter: Optional[str] = None,
    has_attempts: Optional[bool] = None,
    has_devices: Optional[bool] = None,
    has_active_sessions: Optional[bool] = None,
    scoped_institute_id: Optional[int] = None,
) -> list[dict]:
    institute_id = _require_institute(actor, scoped_institute_id)
    query = _member_query(db, institute_id)
    if role_name is not None:
        if role_name not in MANAGED_ROLES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid member role")
        query = query.filter(Role.name == role_name)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(User.email.ilike(term), User.first_name.ilike(term), User.last_name.ilike(term))
        )
    if active is not None:
        query = query.filter(User.is_active.is_(active))
    if status_filter:
        if status_filter == "active":
            query = query.filter(User.is_active.is_(True), User.deleted_at.is_(None))
        elif status_filter == "inactive":
            query = query.filter(User.is_active.is_(False), User.deleted_at.is_(None))
        elif status_filter == "deleted":
            query = query.filter(User.deleted_at.is_not(None))
        elif status_filter == "password_reset":
            query = query.filter(User.force_password_reset.is_(True), User.deleted_at.is_(None))
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid member status filter")
    users = query.order_by(User.created_at.desc()).all()
    metrics = _metrics_for_members(db, [user.id for user in users])
    rows = [serialize_member(user, metrics[user.id]) for user in users]
    if has_attempts is not None:
        rows = [row for row in rows if (row["attempt_count"] > 0) is has_attempts]
    if has_devices is not None:
        rows = [row for row in rows if (row["device_count"] > 0) is has_devices]
    if has_active_sessions is not None:
        rows = [row for row in rows if (row["active_session_count"] > 0) is has_active_sessions]
    return rows


def member_capacity(db: Session, actor: User, scoped_institute_id: Optional[int] = None) -> dict:
    institute_id = _require_institute(actor, scoped_institute_id)
    institute = db.get(Institute, institute_id)
    if institute is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Institute not found")

    counts = subscription_service.usage(db, institute_id)
    limits = {
        "students": institute.student_limit,
        "staff": institute.staff_limit,
    }
    subscription, state = subscription_service.current_subscription(db, institute_id)
    if institute.onboarding_status != "draft" and subscription is not None and subscription.plan is not None:
        limits = {
            "students": subscription.plan.student_limit,
            "staff": subscription.plan.staff_limit,
        }

    can_add = {
        resource: state in ("active", "grace") and limit is not None and counts[resource] < limit
        for resource, limit in limits.items()
    }
    if institute.onboarding_status == "draft":
        can_add = {
            resource: limit is not None and counts[resource] < limit
            for resource, limit in limits.items()
        }

    return {
        "usage": {
            "students": counts["students"],
            "staff": counts["staff"],
        },
        "limits": limits,
        "can_add": can_add,
    }


def get_member_or_404(
    db: Session,
    actor: User,
    member_id: int,
    scoped_institute_id: Optional[int] = None,
) -> User:
    user = _member_query(db, _require_institute(actor, scoped_institute_id)).filter(User.id == member_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    return user


def create_member(
    db: Session,
    actor: User,
    *,
    email: str,
    first_name: str,
    last_name: str,
    role_name: str,
    phone_number: Optional[str],
    address: Optional[str],
    ip: Optional[str],
    scoped_institute_id: Optional[int] = None,
) -> dict:
    institute_id = _require_institute(actor, scoped_institute_id)
    if role_name not in MANAGED_ROLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid member role")

    normalized_email = email.strip().lower()
    if db.query(User).filter(User.email == normalized_email).first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use")

    enforce_limit(db, institute_id, "students" if role_name == STUDENT else "staff")
    role = db.query(Role).filter(Role.name == role_name).first()
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"{role_name} role is not seeded",
        )

    temporary_password = _temporary_password()
    from app.models.institute import Institute
    institute = db.get(Institute, institute_id)
    user = User(
        email=normalized_email,
        password_hash=hash_password(temporary_password),
        role_id=role.id,
        institute_id=institute_id,
        first_name=first_name,
        last_name=last_name,
        phone_number=phone_number,
        address=address,
        is_active=institute is None or institute.onboarding_status != "draft",
        force_password_reset=True,
    )
    db.add(user)
    db.flush()
    _audit(db, actor, "institute_member.create", user.id, ip, {"email": user.email, "role": role_name})
    db.commit()
    result = serialize_member(get_member_or_404(db, actor, user.id, scoped_institute_id))
    result["temporary_password"] = temporary_password
    return result


def update_member(
    db: Session,
    actor: User,
    member_id: int,
    data: dict,
    fields_set: set[str],
    ip: Optional[str],
    scoped_institute_id: Optional[int] = None,
) -> dict:
    user = get_member_or_404(db, actor, member_id, scoped_institute_id)
    if user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Archived members cannot be edited")
    if "email" in fields_set and data.get("email") is not None:
        normalized_email = str(data["email"]).strip().lower()
        if db.query(User).filter(User.email == normalized_email, User.id != user.id).first() is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use")
        user.email = normalized_email
    for field in ("first_name", "last_name", "phone_number", "address"):
        if field in fields_set:
            setattr(user, field, data.get(field))

    db.add(user)
    _audit(db, actor, "institute_member.update", user.id, ip, {"fields": sorted(fields_set)})
    db.commit()
    return serialize_member(get_member_or_404(db, actor, user.id, scoped_institute_id))


def set_member_active(
    db: Session,
    actor: User,
    member_id: int,
    active: bool,
    ip: Optional[str],
    scoped_institute_id: Optional[int] = None,
) -> dict:
    user = get_member_or_404(db, actor, member_id, scoped_institute_id)
    if user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Archived members cannot be reactivated")
    user.is_active = active
    revoked = account_service.revoke_all_sessions(db, user.id) if not active else 0
    db.add(user)
    _audit(
        db,
        actor,
        "institute_member.reactivate" if active else "institute_member.deactivate",
        user.id,
        ip,
        {"sessions_revoked": revoked},
    )
    db.commit()
    return serialize_member(get_member_or_404(db, actor, user.id, scoped_institute_id))


def reset_member_password(
    db: Session,
    actor: User,
    member_id: int,
    ip: Optional[str],
    scoped_institute_id: Optional[int] = None,
) -> str:
    user = get_member_or_404(db, actor, member_id, scoped_institute_id)
    if user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Archived members cannot reset passwords")
    temporary_password = _temporary_password()
    user.password_hash = hash_password(temporary_password)
    user.force_password_reset = True
    revoked = account_service.revoke_all_sessions(db, user.id)
    db.add(user)
    _audit(db, actor, "institute_member.reset_password", user.id, ip, {"sessions_revoked": revoked})
    db.commit()
    return temporary_password


def delete_member(
    db: Session,
    actor: User,
    member_id: int,
    ip: Optional[str],
    scoped_institute_id: Optional[int] = None,
) -> None:
    user = get_member_or_404(db, actor, member_id, scoped_institute_id)
    if user.deleted_at is not None:
        return
    user.is_active = False
    user.deleted_at = datetime.now(timezone.utc)
    revoked = account_service.revoke_all_sessions(db, user.id)
    db.add(user)
    _audit(
        db,
        actor,
        "institute_member.archive",
        user.id,
        ip,
        {"email": user.email, "role": user.role.name, "sessions_revoked": revoked},
    )
    db.commit()


def revoke_member_sessions(
    db: Session,
    actor: User,
    member_id: int,
    ip: Optional[str],
    scoped_institute_id: Optional[int] = None,
) -> int:
    user = get_member_or_404(db, actor, member_id, scoped_institute_id)
    revoked = account_service.revoke_all_sessions(db, user.id)
    _audit(db, actor, "institute_member.revoke_sessions", user.id, ip, {"count": revoked})
    db.commit()
    return revoked


def _normalize_header(value: object) -> str:
    return str(value or "").strip().lower().replace("-", "_").replace(" ", "_")


def _rows_from_upload(content: bytes, filename: str) -> list[dict]:
    suffix = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if suffix == "csv":
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise HTTPException(status_code=400, detail="CSV files must use UTF-8 encoding") from exc
        reader = csv.DictReader(io.StringIO(text))
        if not reader.fieldnames:
            raise HTTPException(status_code=400, detail="The CSV file has no header row")
        return [
            {_normalize_header(key): value for key, value in row.items() if key is not None}
            for row in reader
            if any(str(value or "").strip() for value in row.values())
        ]
    if suffix == "xlsx":
        try:
            workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
            sheet = workbook.active
            values = sheet.iter_rows(values_only=True)
            headers = [_normalize_header(value) for value in next(values)]
            rows = [
                {headers[index]: value for index, value in enumerate(row) if index < len(headers)}
                for row in values
                if any(str(value or "").strip() for value in row)
            ]
            workbook.close()
            return rows
        except (BadZipFile, InvalidFileException, StopIteration, ValueError, OSError) as exc:
            raise HTTPException(status_code=400, detail="Unable to read the Excel workbook") from exc
    raise HTTPException(status_code=400, detail="Upload a .csv or .xlsx file")


def _value(row: dict, *keys: str) -> str:
    for key in keys:
        value = row.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def _import_identity(row: dict) -> tuple[str, str, str, Optional[str], Optional[str]]:
    email = _value(row, "email", "email_address").lower()
    first_name = _value(row, "first_name", "firstname", "given_name")
    last_name = _value(row, "last_name", "lastname", "surname", "family_name")
    if not first_name or not last_name:
        full_name = _value(row, "name", "full_name", "student_name")
        parts = full_name.split()
        if parts:
            first_name = first_name or parts[0]
            last_name = last_name or (" ".join(parts[1:]) if len(parts) > 1 else "-")
    phone = _value(row, "phone_number", "phone", "mobile", "mobile_number") or None
    address = _value(row, "address") or None
    return email, first_name, last_name, phone, address


def _available_student_slots(db: Session, institute_id: int) -> int:
    from app.models.institute import Institute

    institute = db.get(Institute, institute_id)
    if institute is not None and institute.onboarding_status == "draft":
        current = (
            db.query(User)
            .join(Role, User.role_id == Role.id)
            .filter(
                User.institute_id == institute_id,
                User.deleted_at.is_(None),
                Role.name == STUDENT,
            )
            .count()
        )
        return max(0, (institute.student_limit or 0) - current)
    subscription = subscription_service.subscription_status(db, institute_id)
    if subscription["state"] not in ("active", "grace") or not subscription["limits"]:
        raise HTTPException(
            status_code=402,
            detail="This institute has no active subscription. Purchase or renew a plan to add students.",
        )
    return max(0, subscription["limits"]["students"] - subscription["usage"]["students"])


def import_students(
    db: Session,
    actor: User,
    *,
    content: bytes,
    filename: str,
    ip: Optional[str],
    scoped_institute_id: Optional[int] = None,
) -> dict:
    institute_id = _require_institute(actor, scoped_institute_id)
    from app.models.institute import Institute
    institute = db.get(Institute, institute_id)
    rows = _rows_from_upload(content, filename)
    if not rows:
        raise HTTPException(status_code=400, detail="The import file contains no student rows")
    if len(rows) > MAX_IMPORT_ROWS:
        raise HTTPException(status_code=400, detail=f"A single import can contain at most {MAX_IMPORT_ROWS} rows")

    role = db.query(Role).filter(Role.name == STUDENT).first()
    if role is None:
        raise HTTPException(status_code=500, detail="STUDENT role is not seeded")

    available = _available_student_slots(db, institute_id)
    seen: set[str] = set()
    created: list[dict] = []
    skipped: list[dict] = []

    for row_number, row in enumerate(rows, start=2):
        email, first_name, last_name, phone, address = _import_identity(row)
        reason = None
        if not email or not first_name or not last_name:
            reason = "Email and student name are required"
        else:
            try:
                email = str(EMAIL_ADAPTER.validate_python(email)).lower()
            except ValidationError:
                reason = "Invalid email address"
        if reason is None and email in seen:
            reason = "Duplicate email in file"
        seen.add(email)
        if reason is None and db.query(User).filter(func.lower(User.email) == email).first() is not None:
            reason = "Email already exists"
        if reason is None and len(created) >= available:
            reason = "Student plan limit reached"
        if reason is not None:
            skipped.append({"row": row_number, "email": email or None, "reason": reason})
            continue

        temporary_password = _temporary_password()
        user = User(
            email=email,
            password_hash=hash_password(temporary_password),
            role_id=role.id,
            institute_id=institute_id,
            first_name=first_name[:100],
            last_name=last_name[:100],
            phone_number=phone[:50] if phone else None,
            address=address[:255] if address else None,
            is_active=institute is None or institute.onboarding_status != "draft",
            force_password_reset=True,
        )
        db.add(user)
        db.flush()
        _audit(db, actor, "institute_member.import", user.id, ip, {"row": row_number})
        created.append(
            {
                "id": user.id,
                "row": row_number,
                "email": email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "temporary_password": temporary_password,
            }
        )

    db.commit()
    return {
        "summary": {
            "total_rows": len(rows),
            "created": len(created),
            "skipped": len(skipped),
            "remaining_slots": max(0, available - len(created)),
        },
        "created": created,
        "skipped": skipped,
    }


def student_overview(
    db: Session,
    actor: User,
    student_id: int,
    scoped_institute_id: Optional[int] = None,
) -> dict:
    student = get_member_or_404(db, actor, student_id, scoped_institute_id)
    if student.role.name != STUDENT:
        raise HTTPException(status_code=404, detail="Student not found")

    now = datetime.now(timezone.utc)
    active_sessions = (
        db.query(UserSession)
        .filter(
            UserSession.user_id == student.id,
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > now,
        )
        .all()
    )
    active_device_ids = {session.device_id for session in active_sessions if session.device_id is not None}
    devices = (
        db.query(UserDevice)
        .filter(UserDevice.user_id == student.id)
        .order_by(UserDevice.last_seen_at.desc())
        .all()
    )
    attempts = (
        db.query(TestAttempt)
        .options(
            joinedload(TestAttempt.module),
            selectinload(TestAttempt.part_grades).joinedload(AttemptPartGrade.part),
            selectinload(TestAttempt.part_grades).joinedload(AttemptPartGrade.grader),
        )
        .filter(TestAttempt.user_id == student.id)
        .order_by(TestAttempt.started_at.desc())
        .all()
    )
    metrics = _metrics_for_members(db, [student.id])[student.id]
    return {
        "student": serialize_member(student, metrics),
        "security": {
            "device_count": len(devices),
            "active_session_count": len(active_sessions),
            "last_login_at": devices[0].last_seen_at if devices else None,
            "devices": [
                {
                    "id": device.id,
                    "name": device.name,
                    "user_agent": device.user_agent,
                    "last_ip_address": device.last_ip_address,
                    "login_count": device.login_count,
                    "first_seen_at": device.first_seen_at,
                    "last_seen_at": device.last_seen_at,
                    "is_active": device.id in active_device_ids,
                }
                for device in devices
            ],
        },
        "attempts": [
            {
                "id": attempt.id,
                "module_title": attempt.module.title,
                "module_type": attempt.module.module_type,
                "status": attempt.status,
                "started_at": attempt.started_at,
                "submitted_at": attempt.submitted_at,
                "graded_at": attempt.graded_at,
                "raw_score": str(attempt.raw_score) if attempt.raw_score is not None else None,
                "max_score": str(attempt.max_score) if attempt.max_score is not None else None,
                "graders": [
                    {
                        "id": grade.grader.id if grade.grader else None,
                        "name": (
                            f"{grade.grader.first_name} {grade.grader.last_name}"
                            if grade.grader
                            else "Pending"
                        ),
                        "email": grade.grader.email if grade.grader else None,
                        "part": grade.part.title,
                        "status": grade.status,
                        "graded_at": grade.graded_at,
                    }
                    for grade in attempt.part_grades
                ],
            }
            for attempt in attempts
        ],
    }


def dashboard_summary(db: Session, actor: User) -> dict:
    institute_id = _require_institute(actor)
    institute = db.get(Institute, institute_id)
    if institute is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Institute not found")

    members = list_members(db, actor)
    permissions = admin_permissions(actor)
    can_see_students = any(
        permissions[key]
        for key in (
            "view_students",
            "manage_students",
            "view_student_activity",
            "manage_student_sessions",
        )
    )
    visible_members = [
        member
        for member in members
        if (member["role"] == STUDENT and can_see_students)
        or (member["role"] == INST_INSTRUCTOR and permissions["manage_staff"])
    ]
    subscription = (
        subscription_service.subscription_status(db, institute_id)
        if permissions["view_billing"]
        else None
    )
    return {
        "institute": {
            "id": institute.id,
            "name": institute.name,
            "slug": institute.slug,
            "contact_email": institute.contact_email,
            "is_active": institute.is_active,
        },
        "counts": {
            "students": sum(1 for member in members if member["role"] == STUDENT and not member["deleted_at"]),
            "instructors": sum(1 for member in members if member["role"] == INST_INSTRUCTOR and not member["deleted_at"]),
            "active_members": sum(1 for member in visible_members if member["is_active"]),
        },
        "subscription": subscription,
        "permissions": permissions,
        "recent_members": visible_members[:6],
    }
