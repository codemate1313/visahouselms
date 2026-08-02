from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_session, get_current_user, require_role
from app.models.audit_log import AuditLog
from app.models.role import SUPER_ADMIN
from app.models.user import User
from app.models.user_session import UserSession
from app.schemas.auth import CurrentUser
from app.schemas.user import (
    ChangePasswordRequest,
    DirectoryUserOut,
    DirectoryUserPage,
    ForceResetRequest,
    ProfileUpdateRequest,
    SessionOut,
    SuperAdminAccountCreate,
    SuperAdminAccountOut,
    SuperAdminAccountUpdate,
)
from app.services import account_service, ai_evaluation_service, settings_service, super_admin_service

router = APIRouter(
    prefix="/super-admin",
    tags=["super-admin"],
    dependencies=[Depends(require_role(SUPER_ADMIN))],
)


def _client_ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


def _serialize_linked_session(session: UserSession) -> dict:
    return {
        "id": session.id,
        "ip_address": session.ip_address,
        "user_agent": session.user_agent,
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "expires_at": session.expires_at.isoformat() if session.expires_at else None,
        "revoked_at": session.revoked_at.isoformat() if session.revoked_at else None,
        "is_active": session.revoked_at is None,
    }


@router.get("/users", response_model=DirectoryUserPage)
def list_directory_users(
    role: Optional[str] = Query(default=None, max_length=40),
    q: Optional[str] = Query(default=None, max_length=200),
    status: Optional[str] = Query(default=None, pattern="^(active|inactive)$"),
    institute_id: Optional[int] = Query(default=None, ge=1),
    direct: Optional[bool] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Cross-institute directory backing the tabbed Users screen. Every role is
    read through one shape here; the per-role endpoints below remain the place
    where accounts are created and edited."""
    return super_admin_service.list_directory_users(
        db,
        role=role,
        search=q,
        status_filter=status,
        institute_id=institute_id,
        direct=direct,
        page=page,
        page_size=page_size,
    )


@router.post("/users/{user_id}/deactivate")
def deactivate_directory_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    """Suspend a platform-wide student. Institute members keep using their own
    institute's member endpoints, which own the tenant rules."""
    return super_admin_service.set_directory_user_active(db, actor, user_id, False, _client_ip(request))


@router.post("/users/{user_id}/reactivate")
def reactivate_directory_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return super_admin_service.set_directory_user_active(db, actor, user_id, True, _client_ip(request))


@router.get("/users/{user_id}", response_model=DirectoryUserOut)
def get_direct_student_user(user_id: int, db: Session = Depends(get_db)):
    return super_admin_service.serialize_directory_user(
        super_admin_service.get_direct_student_or_404(db, user_id),
        None,
    )


@router.patch("/users/{user_id}", response_model=DirectoryUserOut)
def update_direct_student_user(
    user_id: int,
    payload: ProfileUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    user = super_admin_service.update_direct_student(
        db,
        actor,
        user_id,
        payload.email,
        payload.first_name,
        payload.last_name,
        _client_ip(request),
        payload.dob,
        payload.phone_number,
        payload.address,
        payload.avatar_path,
    )
    return super_admin_service.serialize_directory_user(user, None)


@router.post("/users/{user_id}/reset-password")
def reset_direct_student_password(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return {
        "temporary_password": super_admin_service.reset_direct_student_password(
            db, actor, user_id, _client_ip(request)
        )
    }


@router.delete("/users/{user_id}", status_code=204)
def delete_direct_student_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    super_admin_service.delete_direct_student(db, actor, user_id, _client_ip(request))


@router.get("/accounts", response_model=List[SuperAdminAccountOut])
def list_accounts(db: Session = Depends(get_db)):
    return super_admin_service.list_super_admins(db)


@router.get("/accounts/{account_id}", response_model=SuperAdminAccountOut)
def get_account(account_id: int, db: Session = Depends(get_db)):
    return super_admin_service.get_super_admin_or_404(db, account_id)


@router.post("/accounts", response_model=SuperAdminAccountOut, status_code=201)
def create_account(
    payload: SuperAdminAccountCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return super_admin_service.create_super_admin(
        db,
        actor,
        payload.email,
        payload.password,
        payload.first_name,
        payload.last_name,
        _client_ip(request),
        dob=payload.dob,
        phone_number=payload.phone_number,
        address=payload.address,
        avatar_path=payload.avatar_path,
        can_view_monetary_analytics=payload.can_view_monetary_analytics,
    )


@router.patch("/accounts/{account_id}", response_model=SuperAdminAccountOut)
def update_account(
    account_id: int,
    payload: SuperAdminAccountUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return super_admin_service.update_super_admin(
        db,
        actor,
        account_id,
        payload.email,
        payload.first_name,
        payload.last_name,
        _client_ip(request),
        dob=payload.dob,
        phone_number=payload.phone_number,
        address=payload.address,
        avatar_path=payload.avatar_path,
        can_view_monetary_analytics=payload.can_view_monetary_analytics,
    )


@router.post("/accounts/{account_id}/deactivate", response_model=SuperAdminAccountOut)
def deactivate_account(
    account_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return super_admin_service.deactivate_super_admin(db, actor, account_id, _client_ip(request))


@router.post("/accounts/{account_id}/reactivate", response_model=SuperAdminAccountOut)
def reactivate_account(
    account_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return super_admin_service.reactivate_super_admin(db, actor, account_id, _client_ip(request))


@router.delete("/accounts/{account_id}", status_code=204)
def delete_account(
    account_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    super_admin_service.delete_super_admin(db, actor, account_id, _client_ip(request))


@router.post("/accounts/{account_id}/force-password-reset", response_model=SuperAdminAccountOut)
def force_password_reset(
    account_id: int,
    payload: ForceResetRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return super_admin_service.set_force_password_reset(
        db, actor, account_id, payload.enabled, _client_ip(request)
    )


@router.post("/me/change-password", status_code=204)
def change_my_password(
    payload: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    if actor.force_password_reset:
        account_service.set_initial_password(db, actor, payload.new_password, _client_ip(request))
        return
    super_admin_service.change_password(
        db, actor, payload.current_password, payload.new_password, _client_ip(request)
    )


def _current_user_response(user: User) -> CurrentUser:
    return CurrentUser(
        id=user.id,
        email=user.email,
        role=user.role.name,
        institute_id=user.institute_id,
        institute_slug=user.institute.slug if user.institute else None,
        first_name=user.first_name,
        last_name=user.last_name,
        force_password_reset=user.force_password_reset,
        avatar_url=account_service.avatar_url_for(user),
        is_owner=user.is_owner,
        is_developer_verified=user.is_developer_verified,
        can_view_monetary_analytics=user.is_owner or user.can_view_monetary_analytics,
    )


@router.patch("/me/profile", response_model=CurrentUser)
def update_my_profile(
    payload: ProfileUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    user = account_service.update_profile(
        db, actor, payload.email, payload.first_name, payload.last_name, _client_ip(request)
    )
    return _current_user_response(user)


@router.post("/me/avatar", response_model=CurrentUser)
async def upload_my_avatar(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    user = await account_service.save_avatar(db, actor, file, _client_ip(request))
    return _current_user_response(user)


@router.post("/upload-avatar")
async def upload_account_avatar(
    file: UploadFile = File(...),
):
    return await account_service.save_temp_avatar(file)


@router.get("/me/sessions", response_model=List[SessionOut])
def list_my_sessions(
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
    current_session: UserSession = Depends(get_current_session),
):
    return account_service.list_sessions(db, actor, current_session.id)


@router.delete("/me/sessions/{session_id}", status_code=204)
def revoke_my_session(
    session_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    account_service.revoke_session(db, actor, session_id, _client_ip(request))


@router.post("/me/sessions/revoke-others")
def revoke_my_other_sessions(
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
    current_session: UserSession = Depends(get_current_session),
):
    revoked = account_service.revoke_other_sessions(
        db, actor, current_session.id, _client_ip(request)
    )
    return {"revoked": revoked}


@router.get("/settings/ai")
def get_ai_settings(db: Session = Depends(get_db)):
    return ai_evaluation_service.config_status(db)


@router.put("/settings/ai")
def update_ai_settings(
    payload: dict,
    db: Session = Depends(get_db),
):
    enabled = payload.get("enabled", True)
    provider = payload.get("provider", "gemini")
    model = payload.get("model", "gemini-1.5-flash")
    api_key = payload.get("api_key")
    endpoint_url = payload.get("endpoint_url")
    monthly_limit = payload.get("monthly_limit", 100)

    settings_service.set_setting(db, "ai.enabled", "true" if enabled else "false")
    settings_service.set_setting(db, "ai.provider", str(provider))
    settings_service.set_setting(db, "ai.model", str(model))
    if api_key and api_key != "********":
        settings_service.set_setting(db, "ai.api_key", str(api_key))
    if endpoint_url is not None:
        settings_service.set_setting(db, "ai.endpoint_url", str(endpoint_url))
    settings_service.set_setting(db, "ai.monthly_limit", str(monthly_limit))
    if isinstance(payload.get("api_keys"), list):
        ai_evaluation_service.save_configured_keys(db, payload["api_keys"])

    return ai_evaluation_service.config_status(db)


@router.post("/settings/ai/test-key")
def test_ai_settings_key(payload: dict, db: Session = Depends(get_db)):
    return ai_evaluation_service.test_configured_key(
        db,
        key_id=payload.get("key_id"),
        provider=str(payload.get("provider") or "gemini"),
        api_key=str(payload.get("api_key") or ""),
        model=payload.get("model"),
        endpoint_url=payload.get("endpoint_url"),
        preferred_provider=payload.get("preferred_provider"),
    )


@router.get("/users/{user_id}/linked-details")
def get_user_linked_details(
    user_id: int,
    db: Session = Depends(get_db),
):
    from app.models.attempt import AttemptPartGrade, Enrollment, GradingQueueEntry, TestAttempt
    from app.models.payment import Payment
    from app.models.subscription import Subscription

    user = super_admin_service.get_directory_user_or_404(db, user_id)
    serialized_user = super_admin_service.serialize_directory_user(user, None)

    sessions = (
        db.query(UserSession)
        .filter(UserSession.user_id == user_id)
        .order_by(UserSession.created_at.desc())
        .limit(10)
        .all()
    )
    serialized_sessions = [_serialize_linked_session(s) for s in sessions]

    enrollments = (
        db.query(Enrollment)
        .filter(Enrollment.user_id == user_id)
        .order_by(Enrollment.granted_at.desc())
        .all()
    )
    serialized_enrollments = [
        {
            "id": e.id,
            "course_title": e.course.title if e.course else "Unknown Course",
            "source": e.source,
            "granted_at": e.granted_at.isoformat() if e.granted_at else None,
            "expires_at": e.expires_at.isoformat() if e.expires_at else None,
            "is_active": e.is_active,
        }
        for e in enrollments
    ]

    attempts = (
        db.query(TestAttempt)
        .filter(TestAttempt.user_id == user_id)
        .order_by(TestAttempt.started_at.desc())
        .all()
    )
    serialized_attempts = [
        {
            "id": a.id,
            "module_title": a.module.title if a.module else "Unknown Module",
            "status": a.status,
            "is_final": a.is_final,
            "started_at": a.started_at.isoformat() if a.started_at else None,
            "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None,
            "raw_score": float(a.raw_score) if a.raw_score is not None else None,
            "max_score": float(a.max_score) if a.max_score is not None else None,
            "band_label": a.band_label,
            "cefr_level": a.cefr_level,
        }
        for a in attempts
    ]

    subscriptions = (
        db.query(Subscription)
        .filter(Subscription.user_id == user_id)
        .order_by(Subscription.starts_at.desc())
        .all()
    )
    serialized_subscriptions = [
        {
            "id": sub.id,
            "plan_title": sub.plan.name if sub.plan else (sub.institute_name_snapshot or "Unknown Plan"),
            "starts_at": sub.starts_at.isoformat() if sub.starts_at else None,
            "expires_at": sub.expires_at.isoformat() if sub.expires_at else None,
            "grace_days": sub.grace_days,
            "cancelled_at": sub.cancelled_at.isoformat() if sub.cancelled_at else None,
        }
        for sub in subscriptions
    ]

    payments = (
        db.query(Payment)
        .filter(Payment.user_id == user_id)
        .order_by(Payment.created_at.desc())
        .all()
    )
    serialized_payments = [
        {
            "id": p.id,
            "amount": float(p.amount),
            "final_amount": float(p.final_amount),
            "gateway": p.gateway,
            "gateway_reference": p.gateway_reference,
            "status": p.status,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "paid_at": p.paid_at.isoformat() if p.paid_at else None,
            "invoice_number": p.invoice_number,
        }
        for p in payments
    ]

    audit_logs = (
        db.query(AuditLog)
        .filter(or_(AuditLog.user_id == user_id, AuditLog.entity_id == user_id))
        .order_by(AuditLog.created_at.desc())
        .limit(20)
        .all()
    )
    actor_ids = {log.user_id for log in audit_logs if log.user_id is not None}
    actors = {
        actor.id: actor
        for actor in db.query(User).filter(User.id.in_(actor_ids)).all()
    } if actor_ids else {}
    serialized_audit_logs = [
        {
            "id": log.id,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "details": log.details,
            "created_at": log.created_at.isoformat() if log.created_at else None,
            "ip_address": log.ip_address,
            "actor": (
                {
                    "id": actors[log.user_id].id,
                    "email": actors[log.user_id].email,
                    "first_name": actors[log.user_id].first_name,
                    "last_name": actors[log.user_id].last_name,
                    "role_name": actors[log.user_id].role.name if actors[log.user_id].role else None,
                }
                if log.user_id in actors
                else None
            ),
        }
        for log in audit_logs
    ]

    instructor_metrics = None
    if user.role.name in ("SA_INSTRUCTOR", "INST_INSTRUCTOR"):
        pending_count = (
            db.query(GradingQueueEntry)
            .filter(GradingQueueEntry.assigned_to_id == user_id, GradingQueueEntry.status == "pending")
            .count()
        )
        claimed_count = (
            db.query(GradingQueueEntry)
            .filter(GradingQueueEntry.assigned_to_id == user_id, GradingQueueEntry.status == "claimed")
            .count()
        )
        completed_count = (
            db.query(GradingQueueEntry)
            .filter(GradingQueueEntry.assigned_to_id == user_id, GradingQueueEntry.status == "completed")
            .count()
        )
        total_graded_parts = (
            db.query(AttemptPartGrade)
            .filter(AttemptPartGrade.grader_id == user_id)
            .count()
        )
        instructor_metrics = {
            "pending_grading_count": pending_count,
            "claimed_grading_count": claimed_count,
            "completed_grading_count": completed_count,
            "total_graded_parts_count": total_graded_parts,
        }

    return {
        "user": serialized_user,
        "sessions": serialized_sessions,
        "enrollments": serialized_enrollments,
        "attempts": serialized_attempts,
        "subscriptions": serialized_subscriptions,
        "payments": serialized_payments,
        "audit_logs": serialized_audit_logs,
        "instructor_metrics": instructor_metrics,
    }


@router.post("/users/{user_id}/sessions/{session_id}/revoke")
def revoke_user_session(
    user_id: int,
    session_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    target = super_admin_service.get_directory_user_or_404(db, user_id)
    session = (
        db.query(UserSession)
        .filter(UserSession.id == session_id, UserSession.user_id == target.id)
        .first()
    )
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    if session.revoked_at is None:
        session.revoked_at = datetime.now(timezone.utc)
        db.add(session)
        db.add(
            AuditLog(
                user_id=actor.id,
                action="super_admin.revoke_user_session",
                entity_type="user",
                entity_id=target.id,
                details={
                    "session_id": session.id,
                    "target_user_id": target.id,
                    "target_email": target.email,
                    "target_role": target.role.name if target.role else None,
                },
                ip_address=_client_ip(request),
            )
        )
        db.commit()
        db.refresh(session)

    return _serialize_linked_session(session)
