from typing import Optional

from fastapi import Depends, HTTPException, status
from sqlalchemy import Select

from app.dependencies.auth import get_current_user
from app.models.role import SA_INSTRUCTOR, SUPER_ADMIN
from app.models.user import User

PLATFORM_WIDE_ROLES = (SUPER_ADMIN, SA_INSTRUCTOR)


def get_tenant_institute_id(user: User = Depends(get_current_user)) -> Optional[int]:
    """The one place tenant scope is derived from the authenticated token.

    Every tenant-scoped router (institutes, courses, tests, results - added in
    later phases) must depend on this rather than reading institute_id off the
    request body/query params, so isolation can never be bypassed from the
    frontend. Returns None for platform-wide roles, who are allowed to operate
    across institutes; any institute-scoped role without an institute_id is a
    misconfigured account and is rejected outright.
    """
    if user.role.name in PLATFORM_WIDE_ROLES:
        return None
    if user.institute_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not associated with an institute",
        )
    return user.institute_id


def scope_to_tenant(stmt: Select, model, institute_id: Optional[int]) -> Select:
    """Apply institute_id filtering to a SQLAlchemy select. institute_id=None
    (platform-wide context) skips filtering; any real institute_id filters strictly."""
    if institute_id is None:
        return stmt
    return stmt.where(model.institute_id == institute_id)
