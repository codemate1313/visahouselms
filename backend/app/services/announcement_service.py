import json
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.institute import Institute
from app.models.notification import ANNOUNCEMENT_PUBLISHED, Announcement, StudentNotification
from app.models.role import INSTITUTE_ADMIN, INST_INSTRUCTOR, SA_INSTRUCTOR, STUDENT, SUPER_ADMIN, Role
from app.models.user import User
from app.schemas.announcement import AnnouncementCreate

STAFF_ROLES = (SUPER_ADMIN, SA_INSTRUCTOR, INSTITUTE_ADMIN, INST_INSTRUCTOR)
ALL_NOTIFICATION_ROLES = (*STAFF_ROLES, STUDENT)
ANNOUNCEMENT_LINKS = {
    SUPER_ADMIN: "/super-admin/notifications",
    SA_INSTRUCTOR: "/super-admin/instructor/dashboard",
    INSTITUTE_ADMIN: "/institute-portal/announcements",
    INST_INSTRUCTOR: "/institute-instructor/grading",
    STUDENT: "/student/announcements",
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_ids(val: Optional[str]) -> list[int]:
    if not val:
        return []
    try:
        data = json.loads(val)
        if isinstance(data, list):
            return [int(x) for x in data if str(x).isdigit() or isinstance(x, int)]
    except Exception:
        pass
    return []


def _out(item: Announcement) -> dict:
    return {
        "id": item.id,
        "institute_id": item.institute_id,
        "title": item.title,
        "message": item.message,
        "audience": item.audience,
        "status": item.status,
        "published_at": item.published_at,
        "scheduled_at": item.scheduled_at,
        "expires_at": item.expires_at,
        "target_institute_ids": _parse_ids(item.target_institute_ids),
        "target_user_ids": _parse_ids(item.target_user_ids),
        "created_at": item.created_at,
    }


def process_scheduled_announcements(db: Session) -> int:
    now = _now()
    due = (
        db.query(Announcement)
        .filter(
            Announcement.status == "scheduled",
            Announcement.scheduled_at.is_not(None),
            Announcement.scheduled_at <= now,
        )
        .all()
    )
    count = 0
    for item in due:
        item.status = "published"
        item.published_at = item.scheduled_at or now
        _create_user_notifications(db, item)
        count += 1
    if count > 0:
        db.commit()
    return count


def list_admin_announcements(db: Session, institute_id: Optional[int]) -> list[dict]:
    process_scheduled_announcements(db)
    query = db.query(Announcement).filter(Announcement.institute_id == institute_id)
    return [_out(item) for item in query.order_by(Announcement.created_at.desc()).all()]


def list_student_announcements(db: Session, user: User) -> list[dict]:
    process_scheduled_announcements(db)
    now = _now()
    scope = Announcement.institute_id.is_(None)
    if user.institute_id is not None:
        scope = or_(Announcement.institute_id.is_(None), Announcement.institute_id == user.institute_id)

    rows = (
        db.query(Announcement)
        .filter(
            scope,
            Announcement.status == "published",
            or_(Announcement.expires_at.is_(None), Announcement.expires_at > now),
        )
        .order_by(Announcement.published_at.desc(), Announcement.created_at.desc())
        .all()
    )

    result = []
    for item in rows:
        target_insts = _parse_ids(item.target_institute_ids)
        target_users = _parse_ids(item.target_user_ids)

        if target_insts and user.institute_id not in target_insts:
            continue
        if target_users and user.id not in target_users:
            continue

        audiences = [a.strip() for a in item.audience.split(",") if a.strip()]
        if "all" in audiences or "students" in audiences or "specific_students" in audiences or "institutes" in audiences or not audiences:
            result.append(_out(item))

    return result


def create_announcement(
    db: Session,
    actor: User,
    payload: AnnouncementCreate,
    *,
    institute_id: Optional[int],
) -> dict:
    now = _now()
    status = payload.status
    published_at = None
    scheduled_at = payload.scheduled_at

    if status == "scheduled":
        if scheduled_at is None or scheduled_at <= now:
            status = "published"
            published_at = now
        else:
            published_at = None
    elif status == "published":
        published_at = now
        scheduled_at = None

    target_inst_json = json.dumps(payload.target_institute_ids) if payload.target_institute_ids else None
    target_user_json = json.dumps(payload.target_user_ids) if payload.target_user_ids else None

    item = Announcement(
        institute_id=institute_id,
        title=payload.title.strip(),
        message=payload.message.strip(),
        audience=payload.audience.strip(),
        status=status,
        published_at=published_at,
        scheduled_at=scheduled_at,
        expires_at=payload.expires_at,
        target_institute_ids=target_inst_json,
        target_user_ids=target_user_json,
        created_by_id=actor.id,
    )
    db.add(item)
    db.flush()

    if item.status == "published":
        _create_user_notifications(db, item)

    db.commit()
    db.refresh(item)
    return _out(item)


def _audience_roles(audience_str: str) -> tuple[str, ...]:
    parts = [p.strip() for p in audience_str.split(",") if p.strip()]
    if "all" in parts or not parts:
        return ALL_NOTIFICATION_ROLES
    roles = set()
    if "students" in parts or "specific_students" in parts or "institutes" in parts:
        roles.add(STUDENT)
    if "staff" in parts:
        roles.update(STAFF_ROLES)
    return tuple(roles) if roles else ALL_NOTIFICATION_ROLES


def _create_user_notifications(db: Session, item: Announcement) -> None:
    target_insts = _parse_ids(item.target_institute_ids)
    target_users = _parse_ids(item.target_user_ids)

    query = (
        db.query(User)
        .join(User.role)
        .filter(
            Role.name.in_(_audience_roles(item.audience)),
            User.deleted_at.is_(None),
            User.is_active.is_(True),
        )
    )

    if item.institute_id is not None:
        query = query.filter(User.institute_id == item.institute_id)
    elif target_insts:
        query = query.filter(User.institute_id.in_(target_insts))

    if target_users:
        query = query.filter(User.id.in_(target_users))

    notifications = [
        StudentNotification(
            user_id=user.id,
            announcement_id=item.id,
            kind=ANNOUNCEMENT_PUBLISHED,
            title=item.title,
            message=item.message,
            link_url=ANNOUNCEMENT_LINKS.get(user.role.name),
            created_at=item.published_at or _now(),
        )
        for user in query.all()
    ]
    if notifications:
        db.add_all(notifications)


def get_super_admin_target_options(db: Session) -> dict:
    institutes = (
        db.query(Institute)
        .order_by(Institute.name)
        .all()
    )
    students = (
        db.query(User)
        .join(User.role)
        .filter(Role.name == STUDENT, User.deleted_at.is_(None), User.is_active.is_(True))
        .order_by(User.first_name, User.last_name)
        .all()
    )
    return {
        "institutes": [
            {
                "id": inst.id,
                "name": inst.name,
                "slug": inst.slug,
                "is_active": inst.is_active,
                "onboarding_status": inst.onboarding_status,
            }
            for inst in institutes
        ],
        "students": [
            {
                "id": u.id,
                "name": f"{u.first_name} {u.last_name}".strip() or u.email,
                "email": u.email,
                "institute_id": u.institute_id,
            }
            for u in students
        ],
    }


def get_institute_target_options(db: Session, institute_id: int) -> dict:
    students = (
        db.query(User)
        .join(User.role)
        .filter(
            User.institute_id == institute_id,
            Role.name == STUDENT,
            User.deleted_at.is_(None),
            User.is_active.is_(True),
        )
        .order_by(User.first_name, User.last_name)
        .all()
    )
    return {
        "students": [
            {
                "id": u.id,
                "name": f"{u.first_name} {u.last_name}".strip() or u.email,
                "email": u.email,
            }
            for u in students
        ],
    }
