import json
import logging
from typing import Optional

import requests
from fastapi import HTTPException, status
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import service_account
from sqlalchemy.orm import Session

from app.models.push_device_token import PushDeviceToken
from app.services.settings_service import get_setting

logger = logging.getLogger(__name__)

FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
REQUIRED_SA_FIELDS = {"type", "project_id", "private_key", "client_email", "token_uri"}


def validate_service_account_json(raw_json: str) -> dict:
    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Service account JSON is not valid JSON",
        )
    missing = REQUIRED_SA_FIELDS - set(data)
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Service account JSON is missing fields: {', '.join(sorted(missing))}",
        )
    if data.get("type") != "service_account":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="JSON 'type' must be 'service_account'",
        )
    return data


def _load_credentials(db: Session) -> service_account.Credentials:
    raw = get_setting(db, "fcm.service_account_json")
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="FCM is not configured - upload a service account JSON first",
        )
    data = validate_service_account_json(raw)
    try:
        return service_account.Credentials.from_service_account_info(data, scopes=[FCM_SCOPE])
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Service account JSON is invalid: {exc}",
        )


def test_credentials(db: Session) -> dict:
    """Validate the stored service account by minting a real OAuth token."""
    credentials = _load_credentials(db)
    try:
        credentials.refresh(GoogleAuthRequest())
    except Exception as exc:  # google.auth raises several transport/refresh error types
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not obtain an access token from Google: {exc}",
        )
    return {
        "project_id": credentials.project_id,
        "token_obtained": True,
        "token_expiry": credentials.expiry.isoformat() if credentials.expiry else None,
    }


def _send_raw(
    url: str,
    access_token: str,
    device_token: str,
    title: str,
    body: str,
    link_url: Optional[str] = None,
) -> requests.Response:
    message: dict = {
        "token": device_token,
        "notification": {"title": title, "body": body},
    }
    if link_url:
        message["webpush"] = {"fcm_options": {"link": link_url}}
    return requests.post(
        url,
        json={"message": message},
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=15,
    )


def send_test_notification(db: Session, device_token: str, title: str, body: str) -> dict:
    credentials = _load_credentials(db)
    project_id = get_setting(db, "fcm.project_id") or credentials.project_id
    try:
        credentials.refresh(GoogleAuthRequest())
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not obtain an access token from Google: {exc}",
        )

    url = f"https://fcm.googleapis.com/v1/projects/{project_id}/messages:send"
    response = _send_raw(url, credentials.token, device_token, title, body)
    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"FCM send failed ({response.status_code}): {response.text[:500]}",
        )
    return response.json()


def register_device_token(db: Session, user_id: int, token: str, platform: str = "web") -> PushDeviceToken:
    existing = db.query(PushDeviceToken).filter(PushDeviceToken.token == token).first()
    if existing is not None:
        existing.user_id = user_id
        existing.platform = platform
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing
    device = PushDeviceToken(user_id=user_id, token=token, platform=platform)
    db.add(device)
    db.commit()
    db.refresh(device)
    return device


def unregister_device_token(db: Session, user_id: int, token: str) -> None:
    db.query(PushDeviceToken).filter(
        PushDeviceToken.user_id == user_id, PushDeviceToken.token == token
    ).delete()
    db.commit()


def send_to_user(db: Session, user_id: int, title: str, body: str, link_url: Optional[str] = None) -> None:
    """Push `title`/`body` to every device the user has registered. Tokens FCM
    reports as invalid/unregistered are pruned so they stop being retried."""
    devices = db.query(PushDeviceToken).filter(PushDeviceToken.user_id == user_id).all()
    if not devices:
        return

    credentials = _load_credentials(db)
    project_id = get_setting(db, "fcm.project_id") or credentials.project_id
    credentials.refresh(GoogleAuthRequest())
    url = f"https://fcm.googleapis.com/v1/projects/{project_id}/messages:send"

    stale = []
    for device in devices:
        response = _send_raw(url, credentials.token, device.token, title, body, link_url=link_url)
        if response.status_code == 404 or (
            response.status_code == 400 and "UNREGISTERED" in response.text
        ):
            stale.append(device)
        elif response.status_code != 200:
            from app.services.notification_service import record_send_failure

            logger.warning(
                "FCM send failed for user %s device %s (%s): %s",
                user_id, device.id, response.status_code, response.text[:500],
            )
            record_send_failure(
                db,
                f"FCM push failed for user {user_id} ({response.status_code}): {response.text[:500]}",
                user_id=user_id,
            )
    for device in stale:
        db.delete(device)
    if stale:
        db.commit()


def get_config_status(db: Session) -> dict:
    raw: Optional[str] = get_setting(db, "fcm.service_account_json")
    project_id = get_setting(db, "fcm.project_id")
    detected_project = None
    if raw:
        try:
            detected_project = json.loads(raw).get("project_id")
        except json.JSONDecodeError:
            pass
    return {
        "configured": bool(raw),
        "project_id": project_id or detected_project,
        "web_configured": get_web_config(db) is not None,
        # Not secrets (Firebase web config is designed to be visible client-side),
        # so unlike service_account_json these are safe to echo back for editing.
        "web_api_key": get_setting(db, "fcm.web_api_key"),
        "web_app_id": get_setting(db, "fcm.web_app_id"),
        "web_messaging_sender_id": get_setting(db, "fcm.web_messaging_sender_id"),
        "web_vapid_key": get_setting(db, "fcm.web_vapid_key"),
    }


def get_web_config(db: Session) -> Optional[dict]:
    """Public (non-secret) Firebase Web SDK config used by the frontend to
    register a browser for push notifications. Distinct from the service
    account JSON, which never leaves the server. Returns None until an admin
    has filled in every field the client SDK needs."""
    raw = get_setting(db, "fcm.service_account_json")
    project_id = get_setting(db, "fcm.project_id")
    if not project_id and raw:
        try:
            project_id = json.loads(raw).get("project_id")
        except json.JSONDecodeError:
            project_id = None
    api_key = get_setting(db, "fcm.web_api_key")
    app_id = get_setting(db, "fcm.web_app_id")
    sender_id = get_setting(db, "fcm.web_messaging_sender_id")
    vapid_key = get_setting(db, "fcm.web_vapid_key")
    if not (raw and api_key and app_id and sender_id and vapid_key and project_id):
        return None
    return {
        "apiKey": api_key,
        "authDomain": f"{project_id}.firebaseapp.com",
        "projectId": project_id,
        "messagingSenderId": sender_id,
        "appId": app_id,
        "vapidKey": vapid_key,
    }
