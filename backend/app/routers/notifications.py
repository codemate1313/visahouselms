from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.services import fcm_service, notification_service


router = APIRouter(prefix="/notifications", tags=["notifications"])


class DeviceTokenIn(BaseModel):
    token: str
    platform: str = "web"


@router.get("")
def list_notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return notification_service.list_user_notifications(db, user)


@router.patch("/read-all")
def read_all_notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return {"updated": notification_service.mark_all_notifications_read(db, user)}


@router.patch("/{notification_id}/read")
def read_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return notification_service.mark_notification_read(db, user, notification_id)


@router.patch("/{notification_id}/pin")
def pin_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return notification_service.set_notification_pinned(db, user, notification_id, True)


@router.patch("/{notification_id}/unpin")
def unpin_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return notification_service.set_notification_pinned(db, user, notification_id, False)


@router.get("/push/config")
def push_config(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Public Firebase Web SDK config the frontend needs to register this
    browser for push. Returns null until an admin has fully configured FCM."""
    return {"config": fcm_service.get_web_config(db)}


@router.post("/push/device-token")
def register_device_token(
    payload: DeviceTokenIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fcm_service.register_device_token(db, user.id, payload.token, payload.platform)
    return {"registered": True}


@router.delete("/push/device-token")
def unregister_device_token(
    payload: DeviceTokenIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fcm_service.unregister_device_token(db, user.id, payload.token)
    return {"registered": False}

