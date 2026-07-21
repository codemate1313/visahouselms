from datetime import datetime
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.audit_log import AuditLog
from app.models.role import SUPER_ADMIN, Role
from app.models.user import User


def _super_admin_role(db: Session) -> Role:
    role = db.query(Role).filter(Role.name == SUPER_ADMIN).first()
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPER_ADMIN role is not seeded",
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


def get_super_admin_or_404(db: Session, account_id: int) -> User:
    role = _super_admin_role(db)
    user = db.query(User).filter(User.id == account_id, User.role_id == role.id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return user


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
    _assert_not_last_active_admin(db, role, user)

    _write_audit_log(db, actor, "super_admin.delete", user.id, ip_address, {"email": user.email})
    db.delete(user)
    db.commit()


def set_force_password_reset(
    db: Session, actor: User, account_id: int, enabled: bool, ip_address: Optional[str]
) -> User:
    user = get_super_admin_or_404(db, account_id)
    user.force_password_reset = enabled
    db.add(user)
    _write_audit_log(
        db, actor, "super_admin.force_password_reset", user.id, ip_address, {"enabled": enabled}
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
