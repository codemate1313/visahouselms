from datetime import datetime
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
    return db.query(User).filter(User.role_id == role.id).order_by(User.created_at).all()


def list_developer_managed_accounts(db: Session) -> List[User]:
    super_role = _role_or_500(db, SUPER_ADMIN)
    developer_role = _role_or_500(db, DEVELOPER)
    return (
        db.query(User)
        .filter(User.role_id.in_([super_role.id, developer_role.id]))
        .order_by(User.role_id, User.created_at)
        .all()
    )


def get_super_admin_or_404(db: Session, account_id: int) -> User:
    role = _super_admin_role(db)
    user = db.query(User).filter(User.id == account_id, User.role_id == role.id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return user


def get_developer_managed_account_or_404(db: Session, account_id: int) -> User:
    super_role = _role_or_500(db, SUPER_ADMIN)
    developer_role = _role_or_500(db, DEVELOPER)
    user = db.query(User).filter(User.id == account_id, User.role_id.in_([super_role.id, developer_role.id])).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return user


def _assert_owner_not_mutated(actor: User, user: User, action: str) -> None:
    if user.is_owner and actor.id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"The application owner account cannot be {action}",
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
) -> User:
    role = _super_admin_role(db)
    if db.query(User).filter(User.email == email).first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use")

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
    )
    db.add(user)
    db.flush()
    _write_audit_log(db, actor, "super_admin.create", user.id, ip_address, {"email": email})
    db.commit()
    db.refresh(user)
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
) -> User:
    user = get_super_admin_or_404(db, account_id)
    _assert_owner_not_mutated(actor, user, "changed")

    if email is not None and email != user.email:
        if db.query(User).filter(User.email == email, User.id != user.id).first() is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use")
        user.email = email
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
    _write_audit_log(db, actor, "super_admin.update", user.id, ip_address)
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
    _assert_not_self(actor, user, "deactivate")
    _assert_owner_not_mutated(actor, user, "deactivated")
    _assert_not_last_active_admin(db, role, user)

    user.is_active = False
    db.add(user)
    _write_audit_log(db, actor, "super_admin.deactivate", user.id, ip_address)
    db.commit()
    db.refresh(user)
    return user


def reactivate_super_admin(db: Session, actor: User, account_id: int, ip_address: Optional[str]) -> User:
    user = get_super_admin_or_404(db, account_id)
    user.is_active = True
    db.add(user)
    _write_audit_log(db, actor, "super_admin.reactivate", user.id, ip_address)
    db.commit()
    db.refresh(user)
    return user


def delete_super_admin(db: Session, actor: User, account_id: int, ip_address: Optional[str]) -> None:
    role = _super_admin_role(db)
    user = get_super_admin_or_404(db, account_id)
    _assert_not_self(actor, user, "delete")
    _assert_owner_not_mutated(actor, user, "deleted")
    _assert_not_last_active_admin(db, role, user)

    _write_audit_log(db, actor, "super_admin.delete", user.id, ip_address, {"email": user.email})
    db.delete(user)
    db.commit()


def set_force_password_reset(
    db: Session, actor: User, account_id: int, enabled: bool, ip_address: Optional[str]
) -> User:
    user = get_super_admin_or_404(db, account_id)
    _assert_owner_not_mutated(actor, user, "marked for password reset")
    user.force_password_reset = enabled
    db.add(user)
    _write_audit_log(
        db, actor, "super_admin.force_password_reset", user.id, ip_address, {"enabled": enabled}
    )
    db.commit()
    db.refresh(user)
    return user


def set_managed_force_password_reset(
    db: Session, actor: User, account_id: int, enabled: bool, ip_address: Optional[str]
) -> User:
    user = get_developer_managed_account_or_404(db, account_id)
    _assert_owner_not_mutated(actor, user, "marked for password reset")
    user.force_password_reset = enabled
    db.add(user)
    _write_audit_log(
        db, actor, "developer.force_password_reset", user.id, ip_address, {"enabled": enabled}
    )
    db.commit()
    db.refresh(user)
    return user


def change_password(
    db: Session, actor: User, current_password: str, new_password: str, ip_address: Optional[str]
) -> None:
    if not verify_password(current_password, actor.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

    actor.password_hash = hash_password(new_password)
    actor.force_password_reset = False
    db.add(actor)
    _write_audit_log(db, actor, "super_admin.change_password", actor.id, ip_address)
    db.commit()


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
    role = _role_or_500(db, DEVELOPER)
    if db.query(User).filter(User.email == email).first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use")

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

    if email is not None and email != user.email:
        if db.query(User).filter(User.email == email, User.id != user.id).first() is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use")
        user.email = email
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
    return user


# --- unified user directory ------------------------------------------------
# Backs the Super Admin "Users" screen. The per-role account routers each list a
# single role from their own table joins; this is the one place that reads every
# role through one shape so the tabbed directory cannot drift from them.

DIRECTORY_ROLES = [SUPER_ADMIN, SA_INSTRUCTOR, INSTITUTE_ADMIN, INST_INSTRUCTOR, STUDENT]
MAX_PAGE_SIZE = 200


def _directory_base_query(db: Session):
    """Live (non soft-deleted) users in a directory-visible role."""
    return (
        db.query(User)
        .join(Role, User.role_id == Role.id)
        .filter(User.deleted_at.is_(None), Role.name.in_(DIRECTORY_ROLES))
    )


def _apply_directory_filters(
    query,
    role: Optional[str],
    search: Optional[str],
    status_filter: Optional[str],
    institute_id: Optional[int],
    direct: Optional[bool] = None,
):
    if role:
        query = query.filter(Role.name == role)
    if direct is True:
        query = query.filter(User.institute_id.is_(None))
    elif direct is False:
        query = query.filter(User.institute_id.isnot(None))
    elif institute_id is not None:
        query = query.filter(User.institute_id == institute_id)
    if status_filter == "active":
        query = query.filter(User.is_active.is_(True))
    elif status_filter == "inactive":
        query = query.filter(User.is_active.is_(False))
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                User.email.ilike(term),
                User.first_name.ilike(term),
                User.last_name.ilike(term),
            )
        )
    return query


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


def list_directory_users(
    db: Session,
    role: Optional[str] = None,
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    institute_id: Optional[int] = None,
    direct: Optional[bool] = None,
    page: int = 1,
    page_size: int = 25,
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
        _directory_base_query(db), role, search, status_filter, institute_id, direct
    )
    total = query.order_by(None).count()
    users = (
        query.options(joinedload(User.role), joinedload(User.institute))
        .order_by(User.created_at.desc(), User.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": [
            {
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
                "created_at": user.created_at,
            }
            for user in users
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "role_counts": directory_role_counts(db),
    }
