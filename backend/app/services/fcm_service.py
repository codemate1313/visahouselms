import json
from typing import Optional

import requests
from fastapi import HTTPException, status
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import service_account
from sqlalchemy.orm import Session

from app.services.settings_service import get_setting

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
    payload = {
        "message": {
            "token": device_token,
            "notification": {"title": title, "body": body},
        }
    }
    response = requests.post(
        url,
        json=payload,
        headers={"Authorization": f"Bearer {credentials.token}"},
        timeout=15,
    )
    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"FCM send failed ({response.status_code}): {response.text[:500]}",
        )
    return response.json()


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
    }
