import asyncio
import json
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect, status

from app.config import settings
from app.core.security import verify_password
from app.database import SessionLocal, get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.audit_log import AuditLog
from app.models.role import SUPER_ADMIN
from app.models.user import User
from app.schemas.dev import TerminalOpenIn
from app.services.terminal_service import PRESETS, preset_list
from sqlalchemy.orm import Session

router = APIRouter(prefix="/super-admin/terminal", tags=["terminal"])

TICKET_TTL_SECONDS = 60
IDLE_TIMEOUT_SECONDS = 600


@router.get("/presets", dependencies=[Depends(require_role(SUPER_ADMIN))])
def list_presets():
    return preset_list()


@router.post("/open", dependencies=[Depends(require_role(SUPER_ADMIN))])
def open_terminal(
    payload: TerminalOpenIn,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    """Re-authentication gate: verifies the account password and issues a
    short-lived single-purpose ticket the WebSocket must present."""
    if not verify_password(payload.password, actor.password_hash):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Password is incorrect")

    now = datetime.now(timezone.utc)
    ticket = jwt.encode(
        {
            "sub": str(actor.id),
            "type": "terminal",
            "iat": now,
            "exp": now + timedelta(seconds=TICKET_TTL_SECONDS),
            "jti": uuid4().hex,
        },
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    db.add(
        AuditLog(
            user_id=actor.id,
            action="terminal.open",
            entity_type="terminal",
            entity_id=None,
            details=None,
            ip_address=request.client.host if request.client else None,
        )
    )
    db.commit()
    return {"ticket": ticket, "expires_in": TICKET_TTL_SECONDS}


def _authenticate_ticket(ticket: str) -> int:
    payload = jwt.decode(ticket, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    if payload.get("type") != "terminal":
        raise jwt.InvalidTokenError("wrong token type")
    return int(payload["sub"])


def _audit_command(user_id: int, preset_name: str, ip: str) -> None:
    db = SessionLocal()
    try:
        db.add(
            AuditLog(
                user_id=user_id,
                action="terminal.command",
                entity_type="terminal",
                entity_id=None,
                details={"preset": preset_name},
                ip_address=ip,
            )
        )
        db.commit()
    finally:
        db.close()


@router.websocket("/ws")
async def terminal_ws(websocket: WebSocket):
    ticket = websocket.query_params.get("ticket", "")
    try:
        user_id = _authenticate_ticket(ticket)
    except jwt.PyJWTError:
        await websocket.close(code=4401)
        return

    # confirm the user still exists, is active, and is a super admin
    db = SessionLocal()
    try:
        user = db.get(User, user_id)
        if user is None or not user.is_active or user.role.name != SUPER_ADMIN:
            await websocket.close(code=4403)
            return
    finally:
        db.close()

    await websocket.accept()
    ip = websocket.client.host if websocket.client else ""
    await websocket.send_json({"type": "ready", "message": "Terminal ready. Select a preset command."})

    try:
        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=IDLE_TIMEOUT_SECONDS)
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "closed", "message": "Idle timeout - session closed."})
                await websocket.close(code=4408)
                return

            try:
                message = json.loads(raw)
                preset_name = message.get("preset", "")
            except json.JSONDecodeError:
                preset_name = ""

            preset = PRESETS.get(preset_name)
            if preset is None:
                await websocket.send_json(
                    {"type": "error", "message": f"Unknown or non-whitelisted command: '{preset_name}'"}
                )
                continue

            _audit_command(user_id, preset_name, ip)
            await websocket.send_json({"type": "start", "preset": preset_name})
            async for line in preset.run():
                await websocket.send_json({"type": "line", "data": line})
            await websocket.send_json({"type": "end", "preset": preset_name})
    except WebSocketDisconnect:
        return
