import secrets
import string
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.security import hash_password, verify_password
from app.models.audit_log import AuditLog
from app.models.role import (
    DEVELOPER,
    INST_INSTRUCTOR,
    INSTITUTE_ADMIN,
    SA_INSTRUCTOR,
    STUDENT,
    SUPER_ADMIN,
    Role,
)
from app.models.user import User
from app.services import account_service, notification_service


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


def _super_admin_role(db: Session) -> Role:
    role = db.query(Role).filter(Role.name == SUPER_ADMIN).first()
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPER_ADMIN role is not seeded",
        )
    return role


def _role_or_500(db: Session, role_name: str) -> Role:
    role = db.query(Role).filter(Role.name == role_name).first()
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"{role_name} role is not seeded",
        )
    return role


def _write_audit_log(
    db: Session,
    actor: User,
    action: str,
    entity_id: int,
    ip_address: Optional[str],
    details: Optional[dict] = None,
) -> None:
    db.add(
        AuditLog(
            user_id=actor.id,
            action=action,
            entity_type="user",
            entity_id=entity_id,
            details=details,
            ip_address=ip_address,
        )
    )


def list_super_admins(db: Session) -> List[User]:
    role = _super_admin_role(db)
    # Retired accounts are kept for their audit trail, not for this list.
    return (
        db.query(User)
        .filter(User.role_id == role.id, User.deleted_at.is_(None))
        .order_by(User.created_at)
        .all()
    )


def list_developer_managed_accounts(db: Session) -> List[User]:
    """All live accounts visible to the developer authority panel.

    The name is kept for route compatibility, but the developer layer now owns
    platform-wide emergency controls - role changes and soft deletion - so this
    must not be limited to elevated roles.
    """
    return (
        db.query(User)
        .join(Role, User.role_id == Role.id)
        .filter(User.deleted_at.is_(None))
        .order_by(Role.name, User.created_at, User.id)
        .all()
    )


def get_super_admin_or_404(db: Session, account_id: int) -> User:
    role = _super_admin_role(db)
    # Also excluded by id, not just from the list: a retired account reachable
    # through a stale URL is still an editable account.
    user = (
        db.query(User)
        .filter(User.id == account_id, User.role_id == role.id, User.deleted_at.is_(None))
        .first()
    )
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return user


def get_developer_managed_account_or_404(db: Session, account_id: int) -> User:
    user = (
        db.query(User)
        .filter(User.id == account_id, User.deleted_at.is_(None))
        .first()
    )
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return user


def _assert_owner_not_mutated(actor: User, user: User, action: str) -> None:
    if user.is_owner and actor.id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"The application owner account cannot be {action}",
        )


def _require_owner(
    actor: User,
    detail: str = "Only the owner account can manage other super admin accounts",
) -> None:
    """Only the owner account may create, edit, deactivate, reactivate, delete,
    or force-reset a super admin account. Self-service for a super admin's own
    account goes through account_service.update_profile / /me/profile instead,
    so there is no self-carveout here.
    """
    if not actor.is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )


def create_super_admin(
    db: Session,
    actor: User,
    email: str,
    password: str,
    first_name: str,
    last_name: str,
    ip_address: Optional[str],
    dob: Optional[datetime] = None,
    phone_number: Optional[str] = None,
    address: Optional[str] = None,
    avatar_path: Optional[str] = None,
    can_view_monetary_analytics: bool = False,
) -> User:
    role = _super_admin_role(db)
    _require_owner(actor)
    if can_view_monetary_analytics and not actor.is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner account can grant monetary analytics access",
        )
    email = account_service.ensure_user_credentials_available(db, email)

    user = User(
        email=email,
        password_hash=hash_password(password),
        role_id=role.id,
        institute_id=None,
        first_name=first_name,
        last_name=last_name,
        is_active=True,
        dob=dob,
        phone_number=phone_number,
        address=address,
        avatar_path=avatar_path,
        can_view_monetary_analytics=can_view_monetary_analytics if actor.is_owner else False,
    )
    db.add(user)
    db.flush()
    _write_audit_log(
        db,
        actor,
        "super_admin.create",
        user.id,
        ip_address,
        {"email": email, "can_view_monetary_analytics": user.can_view_monetary_analytics},
    )
    db.commit()
    db.refresh(user)
    notification_service.notify_security_event(
        db,
        "Super Admin account created",
        f"{actor.email} created Super Admin {user.email}.",
        link_url="/super-admin/users/super-admins",
    )
    return user


def _require_verified_developer(db: Session, actor: User) -> None:
    developer_role = _role_or_500(db, DEVELOPER)
    if actor.role_id != developer_role.id or not actor.is_developer_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only a verified developer can create elevated accounts from this panel",
        )


def create_developer_managed_super_admin(
    db: Session,
    actor: User,
    email: str,
    password: str,
    first_name: str,
    last_name: str,
    ip_address: Optional[str],
    *,
    is_owner: bool = True,
    dob: Optional[datetime] = None,
    phone_number: Optional[str] = None,
    address: Optional[str] = None,
    avatar_path: Optional[str] = None,
    can_view_monetary_analytics: bool = False,
) -> User:
    _require_verified_developer(db, actor)
    role = _super_admin_role(db)
    email = account_service.ensure_user_credentials_available(db, email)

    user = User(
        email=email,
        password_hash=hash_password(password),
        role_id=role.id,
        institute_id=None,
        first_name=first_name,
        last_name=last_name,
        is_active=True,
        is_owner=is_owner,
        dob=dob,
        phone_number=phone_number,
        address=address,
        avatar_path=avatar_path,
        can_view_monetary_analytics=can_view_monetary_analytics,
    )
    db.add(user)
    db.flush()
    _write_audit_log(
        db,
        actor,
        "developer.super_admin_owner_create" if is_owner else "developer.super_admin_create",
        user.id,
        ip_address,
        {
            "email": email,
            "is_owner": user.is_owner,
            "can_view_monetary_analytics": user.can_view_monetary_analytics,
        },
    )
    db.commit()
    db.refresh(user)
    notification_service.notify_security_event(
        db,
        "Super Admin Owner account created" if is_owner else "Super Admin account created",
        f"{actor.email} created {'Owner ' if is_owner else ''}Super Admin {user.email}.",
        link_url="/super-admin/users/super-admins",
    )
    return user


def update_super_admin(
    db: Session,
    actor: User,
    account_id: int,
    email: Optional[str],
    first_name: Optional[str],
    last_name: Optional[str],
    ip_address: Optional[str],
    dob: Optional[datetime] = None,
    phone_number: Optional[str] = None,
    address: Optional[str] = None,
    avatar_path: Optional[str] = None,
    can_view_monetary_analytics: Optional[bool] = None,
) -> User:
    user = get_super_admin_or_404(db, account_id)
    _require_owner(actor)
    _assert_owner_not_mutated(actor, user, "changed")

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
    if can_view_monetary_analytics is not None:
        if not actor.is_owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the owner account can change monetary analytics access",
            )
        user.can_view_monetary_analytics = can_view_monetary_analytics

    db.add(user)
    _write_audit_log(
        db,
        actor,
        "super_admin.update",
        user.id,
        ip_address,
        (
            {"can_view_monetary_analytics": user.can_view_monetary_analytics}
            if can_view_monetary_analytics is not None
            else None
        ),
    )
    db.commit()
    db.refresh(user)
    return user


def _assert_not_last_active_admin(db: Session, role: Role, user: User) -> None:
    active_count = (
        db.query(User)
        .filter(User.role_id == role.id, User.is_active.is_(True))
        .count()
    )
    if active_count <= 1 and user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate or delete the last active super admin account",
        )


def _assert_not_self(actor: User, user: User, action: str) -> None:
    if actor.id == user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You cannot {action} your own account",
        )


def deactivate_super_admin(db: Session, actor: User, account_id: int, ip_address: Optional[str]) -> User:
    role = _super_admin_role(db)
    user = get_super_admin_or_404(db, account_id)
    _require_owner(actor)
    _assert_not_self(actor, user, "deactivate")
    _assert_owner_not_mutated(actor, user, "deactivated")
    _assert_not_last_active_admin(db, role, user)

    user.is_active = False
    db.add(user)
    _write_audit_log(db, actor, "super_admin.deactivate", user.id, ip_address)
    db.commit()
    db.refresh(user)
    notification_service.notify_security_event(
        db,
        "Super Admin account deactivated",
        f"{actor.email} deactivated Super Admin {user.email}.",
        link_url="/super-admin/users/super-admins",
    )
    return user


def reactivate_super_admin(db: Session, actor: User, account_id: int, ip_address: Optional[str]) -> User:
    user = get_super_admin_or_404(db, account_id)
    _require_owner(actor)
    user.is_active = True
    db.add(user)
    _write_audit_log(db, actor, "super_admin.reactivate", user.id, ip_address)
    db.commit()
    db.refresh(user)
    notification_service.notify_security_event(
        db,
        "Super Admin account reactivated",
        f"{actor.email} reactivated Super Admin {user.email}.",
        link_url="/super-admin/users/super-admins",
    )
    return user


def delete_super_admin(db: Session, actor: User, account_id: int, ip_address: Optional[str]) -> None:
    role = _super_admin_role(db)
    user = get_super_admin_or_404(db, account_id)
    _require_owner(actor)
    _assert_not_self(actor, user, "delete")
    _assert_owner_not_mutated(actor, user, "deleted")
    _assert_not_last_active_admin(db, role, user)

    deleted_email = user.email
    _write_audit_log(db, actor, "super_admin.delete", user.id, ip_address, {"email": user.email})
    # Audit first, then retire: this account's own audit trail is the record of
    # what it did, and destroying the row would take that with it.
    account_service.soft_delete_user(db, user)
    db.commit()
    notification_service.notify_security_event(
        db,
        "Super Admin account deleted",
        f"{actor.email} deleted Super Admin {deleted_email}.",
        link_url="/super-admin/users/super-admins",
    )


def set_force_password_reset(
    db: Session, actor: User, account_id: int, enabled: bool, ip_address: Optional[str]
) -> User:
    user = get_super_admin_or_404(db, account_id)
    _require_owner(actor)
    _assert_owner_not_mutated(actor, user, "marked for password reset")
    user.force_password_reset = enabled
    db.add(user)
    _write_audit_log(
        db, actor, "super_admin.force_password_reset", user.id, ip_address, {"enabled": enabled}
    )
    db.commit()
    db.refresh(user)
    notification_service.notify_security_event(
        db,
        "Super Admin password reset flag changed",
        f"{actor.email} set force password reset for Super Admin {user.email} to {enabled}.",
        link_url="/super-admin/users/super-admins",
    )
    return user


def set_managed_force_password_reset(
    db: Session, actor: User, account_id: int, enabled: bool, ip_address: Optional[str]
) -> User:
    user = get_developer_managed_account_or_404(db, account_id)
    # The developer layer sits above the owner, so it may require a reset on any
    # managed account, the owner included - this is only reachable from the
    # developer panel. Marking a login for reset is reversible and does not lock
    # anyone out, so there is no last-admin concern here.
    user.force_password_reset = enabled
    db.add(user)
    _write_audit_log(
        db, actor, "developer.force_password_reset", user.id, ip_address, {"enabled": enabled}
    )
    db.commit()
    notification_service.notify_security_event(
        db,
        "Developer password reset flag changed",
        f"{actor.email} set force password reset for Developer {user.email} to {enabled}.",
        link_url="/super-admin/users/developers",
    )
    db.refresh(user)
    return user


def reset_developer_managed_password(
    db: Session,
    actor: User,
    account_id: int,
    ip_address: Optional[str],
) -> str:
    _require_verified_developer(db, actor)
    user = get_developer_managed_account_or_404(db, account_id)
    temporary_password = _temporary_password()
    user.password_hash = hash_password(temporary_password)
    user.force_password_reset = True
    user.password_changed_at = None
    revoked = account_service.revoke_all_sessions(db, user.id)
    db.add(user)
    _write_audit_log(
        db,
        actor,
        "developer.password_reset",
        user.id,
        ip_address,
        {
            "email": user.email,
            "role": user.role_name,
            "sessions_revoked": revoked,
        },
    )
    db.commit()
    notification_service.notify_security_event(
        db,
        "Developer reset account password",
        f"{actor.email} reset the password for {user.email}.",
        link_url="/super-admin/logs",
    )
    return temporary_password


def change_password(
    db: Session, actor: User, current_password: Optional[str], new_password: str, ip_address: Optional[str]
) -> None:
    if not current_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is required")
    if not verify_password(current_password, actor.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

    actor.password_hash = hash_password(new_password)
    actor.force_password_reset = False
    actor.password_changed_at = datetime.now(timezone.utc)
    db.add(actor)
    _write_audit_log(db, actor, "super_admin.change_password", actor.id, ip_address)
    db.commit()
    notification_service.create_notification(
        db,
        user_id=actor.id,
        kind="account_password_changed",
        title="Password changed",
        message="Your account password was changed.",
        link_url="/super-admin/sessions",
    )


def create_developer(
    db: Session,
    actor: User,
    email: str,
    password: str,
    first_name: str,
    last_name: str,
    ip_address: Optional[str],
    verified: bool = True,
) -> User:
    _require_owner(actor, detail="Only the owner account can create developer accounts")
    role = _role_or_500(db, DEVELOPER)
    email = account_service.ensure_user_credentials_available(db, email)

    user = User(
        email=email,
        password_hash=hash_password(password),
        role_id=role.id,
        institute_id=None,
        first_name=first_name,
        last_name=last_name,
        is_active=True,
        is_developer_verified=verified,
    )
    db.add(user)
    db.flush()
    _write_audit_log(db, actor, "developer.create", user.id, ip_address, {"email": email, "verified": verified})
    db.commit()
    db.refresh(user)
    notification_service.notify_security_event(
        db,
        "Developer account created",
        f"{actor.email} created Developer {user.email}.",
        link_url="/super-admin/users/developers",
    )
    return user


def create_developer_managed_developer(
    db: Session,
    actor: User,
    email: str,
    password: str,
    first_name: str,
    last_name: str,
    ip_address: Optional[str],
    verified: bool = True,
) -> User:
    _require_verified_developer(db, actor)
    role = _role_or_500(db, DEVELOPER)
    email = account_service.ensure_user_credentials_available(db, email)

    user = User(
        email=email,
        password_hash=hash_password(password),
        role_id=role.id,
        institute_id=None,
        first_name=first_name,
        last_name=last_name,
        is_active=True,
        is_developer_verified=verified,
    )
    db.add(user)
    db.flush()
    _write_audit_log(db, actor, "developer.developer_create", user.id, ip_address, {"email": email, "verified": verified})
    db.commit()
    db.refresh(user)
    notification_service.notify_security_event(
        db,
        "Developer account created",
        f"{actor.email} created Developer {user.email}.",
        link_url="/super-admin/users/developers",
    )
    return user


def update_developer_account(
    db: Session,
    actor: User,
    account_id: int,
    email: Optional[str],
    first_name: Optional[str],
    last_name: Optional[str],
    verified: Optional[bool],
    ip_address: Optional[str],
) -> User:
    user = get_developer_managed_account_or_404(db, account_id)
    _assert_owner_not_mutated(actor, user, "changed")

    if email is not None and account_service.normalize_email(email) != account_service.normalize_email(user.email):
        user.email = account_service.ensure_user_credentials_available(
            db, email, exclude_user_id=user.id
        )
    if first_name is not None:
        user.first_name = first_name
    if last_name is not None:
        user.last_name = last_name
    if verified is not None:
        user.is_developer_verified = verified

    db.add(user)
    _write_audit_log(db, actor, "developer.account_update", user.id, ip_address)
    db.commit()
    db.refresh(user)
    if verified is not None:
        notification_service.notify_security_event(
            db,
            "Developer verification changed",
            f"{actor.email} set Developer {user.email} verification to {user.is_developer_verified}.",
            link_url="/super-admin/users/developers",
        )
    return user


# --- unified user directory ------------------------------------------------
# Backs the Super Admin "Users" screen. The per-role account routers each list a
# single role from their own table joins; this is the one place that reads every
# role through one shape so the tabbed directory cannot drift from them.

DIRECTORY_ROLES = [SUPER_ADMIN, SA_INSTRUCTOR, INSTITUTE_ADMIN, INST_INSTRUCTOR, STUDENT]
MAX_PAGE_SIZE = 200


def _directory_base_query(db: Session, *, include_deleted: bool = False):
    """Directory-visible users.

    Normal views stay on live accounts. The explicit Deleted status opts into
    retired rows so the UI can show the preservation segment without letting
    archived accounts leak back into operational lists.
    """
    query = (
        db.query(User)
        .join(Role, User.role_id == Role.id)
        .filter(Role.name.in_(DIRECTORY_ROLES))
    )
    if not include_deleted:
        query = query.filter(User.deleted_at.is_(None))
    return query


def _apply_directory_filters(
    query,
    role: Optional[str],
    search: Optional[str],
    status_filter: Optional[str],
    institute_id: Optional[int],
    direct: Optional[bool] = None,
    search_by_id_only: Optional[bool] = None,
):
    if role:
        query = query.filter(Role.name == role)
    if direct is True:
        query = query.filter(User.institute_id.is_(None))
    elif direct is False:
        query = query.filter(User.institute_id.isnot(None))
    if institute_id is not None:
        query = query.filter(User.institute_id == institute_id)
    if status_filter == "active":
        query = query.filter(User.is_active.is_(True), User.deleted_at.is_(None))
    elif status_filter == "inactive":
        query = query.filter(User.is_active.is_(False), User.deleted_at.is_(None))
    elif status_filter == "deleted":
        query = query.filter(User.deleted_at.is_not(None))
    if search:
        search_stripped = search.strip()
        if search_by_id_only:
            if search_stripped.isdigit():
                query = query.filter(User.id == int(search_stripped))
            else:
                # Return empty list if query is not numeric when searching by ID only
                query = query.filter(User.id == -1)
        else:
            term = f"%{search_stripped}%"
            conditions = [
                User.email.ilike(term),
                User.first_name.ilike(term),
                User.last_name.ilike(term),
            ]
            if search_stripped.isdigit():
                conditions.append(User.id == int(search_stripped))
            query = query.filter(or_(*conditions))
    return query


# Every action that rewrites a password hash, whoever triggered it. Kept as an
# explicit list so an unrelated new audit action cannot silently join the trail.
PASSWORD_AUDIT_ACTIONS = (
    "account.change_password",
    "account.set_initial_password",
    "account.reset_password_via_email",
    "super_admin.change_password",
    "sa_instructor.reset_password",
    "institute_member.reset_password",
    "institute_admin.reset_password",
    "student.direct.reset_password",
)
SELF_SERVICE_PASSWORD_ACTIONS = {
    "account.change_password",
    "account.set_initial_password",
    "account.reset_password_via_email",
    "super_admin.change_password",
}


def _last_password_changes(db: Session, user_ids: List[int]) -> dict:
    """Newest password event per user for the rows on screen - one query for the
    page rather than a join that would fan out the directory listing."""
    if not user_ids:
        return {}

    rows = (
        db.query(AuditLog)
        .filter(
            AuditLog.entity_id.in_(user_ids),
            AuditLog.action.in_(PASSWORD_AUDIT_ACTIONS),
        )
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .all()
    )

    actor_ids = {row.user_id for row in rows if row.user_id is not None}
    actors = (
        {user.id: user for user in db.query(User).filter(User.id.in_(actor_ids)).all()}
        if actor_ids
        else {}
    )

    # The developer layer is a silent backdoor - a reset it performs must
    # never surface as "reset by <name>" here, so its rows are skipped as if
    # they never happened rather than merely hiding the name on this one.
    newest: dict = {}
    for row in rows:
        if row.entity_id in newest:
            continue
        actor = actors.get(row.user_id) if row.user_id else None
        if actor is not None and actor.role.name == "DEVELOPER":
            continue
        newest[row.entity_id] = row

    result = {}
    for user_id, row in newest.items():
        actor = actors.get(row.user_id) if row.user_id else None
        result[user_id] = {
            "at": row.created_at,
            "action": row.action,
            "by_self": row.action in SELF_SERVICE_PASSWORD_ACTIONS or row.user_id == user_id,
            "by_name": f"{actor.first_name} {actor.last_name}" if actor else None,
            "ip_address": row.ip_address,
        }
    return result


def directory_role_counts(db: Session) -> dict:
    """Row count per role, used for the tab badges. Always unfiltered by role so
    every tab shows its true total."""
    rows = (
        _directory_base_query(db)
        .with_entities(Role.name, func.count(User.id))
        .group_by(Role.name)
        .all()
    )
    counts = {name: 0 for name in DIRECTORY_ROLES}
    for name, total in rows:
        counts[name] = total
    return counts


def serialize_directory_user(user: User, last_password_change: Optional[dict] = None) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role_name": user.role.name,
        "is_active": user.is_active,
        "force_password_reset": user.force_password_reset,
        "is_owner": user.is_owner,
        "avatar_path": user.avatar_path,
        "institute_id": user.institute_id,
        "institute_name": user.institute.name if user.institute else None,
        "institute_slug": user.institute.slug if user.institute else None,
        "phone_number": user.phone_number,
        "address": user.address,
        "created_at": user.created_at,
        "deleted_at": user.deleted_at,
        "password_changed_at": user.password_changed_at,
        "last_password_change": last_password_change,
    }


def list_directory_users(
    db: Session,
    role: Optional[str] = None,
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    institute_id: Optional[int] = None,
    direct: Optional[bool] = None,
    page: int = 1,
    page_size: int = 25,
    search_by_id_only: Optional[bool] = None,
) -> dict:
    """Paginated cross-institute user listing for the Super Admin directory.

    Students alone can run to thousands of rows, so this always paginates rather
    than returning the whole table the way the per-role endpoints do.
    """
    if role is not None and role not in DIRECTORY_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown role '{role}'",
        )
    page = max(1, page)
    page_size = max(1, min(page_size, MAX_PAGE_SIZE))

    query = _apply_directory_filters(
        _directory_base_query(db, include_deleted=status_filter == "deleted"),
        role,
        search,
        status_filter,
        institute_id,
        direct,
        search_by_id_only,
    )
    total = query.order_by(None).count()
    users = (
        query.options(joinedload(User.role), joinedload(User.institute))
        .order_by(User.created_at.desc(), User.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    password_changes = _last_password_changes(db, [user.id for user in users])

    return {
        "items": [
            serialize_directory_user(user, password_changes.get(user.id))
            for user in users
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "role_counts": directory_role_counts(db),
    }


def set_directory_user_active(
    db: Session,
    actor: User,
    user_id: int,
    active: bool,
    ip_address: Optional[str] = None,
) -> dict:
    """Suspend or restore a platform-wide student straight from the directory.

    Institute members are deliberately not routed through here: their own
    institute endpoints own the tenant rules (seat limits, draft institutes,
    membership), so the directory hands those rows off rather than growing a
    second way to manage them. A direct student belongs to no institute, so
    the directory is the only place they can be managed from.
    """
    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.is_owner:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The owner account cannot be suspended")
    if user.role.name != STUDENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{user.role.name} accounts are managed from their own screen",
        )
    if user.institute_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This student belongs to an institute - manage them from that institute",
        )

    user.is_active = active
    db.add(user)
    _write_audit_log(
        db, actor, "student.reactivate" if active else "student.deactivate", user.id, ip_address
    )
    db.commit()
    db.refresh(user)
    notification_service.send_account_status_email(db, user, active)
    return {"id": user.id, "email": user.email, "is_active": user.is_active}


def get_direct_student_or_404(db: Session, user_id: int) -> User:
    user = (
        db.query(User)
        .join(Role)
        .filter(
            User.id == user_id,
            User.deleted_at.is_(None),
            User.institute_id.is_(None),
            Role.name == STUDENT,
        )
        .first()
    )
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Direct student not found")
    return user


def create_direct_student(
    db: Session,
    actor: User,
    email: str,
    first_name: str,
    last_name: str,
    phone_number: str,
    address: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> tuple[User, str]:
    role = _role_or_500(db, STUDENT)
    temporary_password = _temporary_password()
    user = User(
        email=account_service.ensure_user_credentials_available(db, email),
        password_hash=hash_password(temporary_password),
        role_id=role.id,
        first_name=first_name,
        last_name=last_name,
        phone_number=phone_number,
        address=address,
        institute_id=None,
        is_active=True,
        force_password_reset=True,
        password_changed_at=None,
    )
    db.add(user)
    db.flush()
    _write_audit_log(db, actor, "student.direct.create", user.id, ip_address)
    db.commit()
    db.refresh(user)
    return user, temporary_password


def get_directory_user_or_404(db: Session, user_id: int, *, include_deleted: bool = False) -> User:
    query = (
        db.query(User)
        .join(Role)
        .options(joinedload(User.role), joinedload(User.institute))
        .filter(User.id == user_id, Role.name.in_(DIRECTORY_ROLES))
    )
    if not include_deleted:
        query = query.filter(User.deleted_at.is_(None))
    user = query.first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def update_direct_student(
    db: Session,
    actor: User,
    user_id: int,
    email: Optional[str],
    first_name: Optional[str],
    last_name: Optional[str],
    ip_address: Optional[str] = None,
    dob: Optional[datetime] = None,
    phone_number: Optional[str] = None,
    address: Optional[str] = None,
    avatar_path: Optional[str] = None,
) -> User:
    user = get_direct_student_or_404(db, user_id)
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

    db.add(user)
    _write_audit_log(db, actor, "student.direct.update", user.id, ip_address)
    db.commit()
    db.refresh(user)
    return user


def update_directory_user(
    db: Session,
    actor: User,
    user_id: int,
    email: Optional[str],
    first_name: Optional[str],
    last_name: Optional[str],
    ip_address: Optional[str] = None,
    dob: Optional[datetime] = None,
    phone_number: Optional[str] = None,
    address: Optional[str] = None,
    avatar_path: Optional[str] = None,
) -> User:
    user = get_directory_user_or_404(db, user_id)
    role_name = user.role.name if user.role else ""
    if role_name in (SUPER_ADMIN, SA_INSTRUCTOR):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use the role-specific editor for this account",
        )
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

    db.add(user)
    _write_audit_log(db, actor, "directory_user.update", user.id, ip_address, {"role": role_name})
    db.commit()
    db.refresh(user)
    return user


def reset_direct_student_password(
    db: Session,
    actor: User,
    user_id: int,
    ip_address: Optional[str] = None,
) -> str:
    user = get_direct_student_or_404(db, user_id)
    temporary_password = _temporary_password()
    user.password_hash = hash_password(temporary_password)
    user.force_password_reset = True
    user.password_changed_at = datetime.now(timezone.utc)
    revoked = account_service.revoke_all_sessions(db, user.id)
    db.add(user)
    _write_audit_log(
        db,
        actor,
        "student.direct.reset_password",
        user.id,
        ip_address,
        {"sessions_revoked": revoked},
    )
    db.commit()

    try:
        from app.config import settings
        from app.services import email_template_service, smtp_service

        login_url = f"{settings.frontend_url.rstrip('/')}/login"
        first_name = user.first_name or "Student"
        subject, plain, html = email_template_service.render_password_reset_by_admin_email(
            first_name=first_name,
            email=user.email,
            new_password=temporary_password,
            login_url=login_url,
        )
        smtp_service.send_email(db, user.email, subject, plain, html)
    except Exception:
        pass

    return temporary_password


def delete_direct_student(
    db: Session,
    actor: User,
    user_id: int,
    ip_address: Optional[str] = None,
) -> None:
    user = get_direct_student_or_404(db, user_id)
    deleted_email = user.email
    _write_audit_log(
        db,
        actor,
        "student.direct.delete",
        user.id,
        ip_address,
        {"email": deleted_email},
    )
    # A direct student has paid for something. Removing the row would orphan
    # those payments and the attempts they bought, so the account is retired
    # and the financial history stays attached to it.
    account_service.soft_delete_user(db, user)
    db.commit()
