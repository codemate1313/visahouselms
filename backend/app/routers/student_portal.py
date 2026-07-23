from typing import Optional

from fastapi import APIRouter, Depends, File, Header, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.core.uploads import read_validated_speaking_answer
from app.core.auth_cookies import find_refresh_token, get_refresh_token
from app.database import get_db
from app.dependencies.auth import get_current_session
from app.dependencies.student_access import require_module_access, require_student
from app.models.attempt import ATTEMPT_FLAG_TYPES
from app.models.exam_module import ExamModule
from app.models.user import User
from app.models.user_session import UserSession
from app.schemas.auth import CurrentUser
from app.schemas.student import (
    AnswerSaveRequest,
    FinalTestHeartbeatRequest,
    FinalTestPreflightRequest,
    PlanSubscribeRequest,
    ProctorFlagRequest,
    ReevaluationCreateRequest,
)
from app.schemas.user import ChangePasswordRequest, ProfileUpdateRequest, RevokeOthersRequest, SessionOut
from app.services import (
    account_service,
    achievement_service,
    attempt_service,
    grading_service,
    notification_service,
    payment_service,
    plan_service,
    student_analysis_service,
    subscription_service,
)

router = APIRouter(
    prefix="/student",
    tags=["student-portal"],
    dependencies=[Depends(require_student)],
)


def _ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


def _current_user_out(user: User) -> CurrentUser:
    return CurrentUser(
        id=user.id,
        email=user.email,
        role=user.role.name,
        institute_id=user.institute_id,
        first_name=user.first_name,
        last_name=user.last_name,
        force_password_reset=user.force_password_reset,
        avatar_url=account_service.avatar_url_for(user),
    )


@router.get("/me/profile", response_model=CurrentUser)
def get_my_profile(user: User = Depends(require_student)):
    return _current_user_out(user)


@router.patch("/me/profile", response_model=CurrentUser)
def update_my_profile(
    payload: ProfileUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    updated = account_service.update_profile(db, user, payload.email, payload.first_name, payload.last_name, _ip(request))
    return _current_user_out(updated)


@router.post("/me/avatar", response_model=CurrentUser)
async def upload_my_avatar(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    return _current_user_out(await account_service.save_avatar(db, user, file, _ip(request)))


@router.get("/notifications")
def list_notifications(db: Session = Depends(get_db), user: User = Depends(require_student)):
    return notification_service.list_student_notifications(db, user)


@router.patch("/notifications/read-all")
def read_all_notifications(db: Session = Depends(get_db), user: User = Depends(require_student)):
    return {"updated": notification_service.mark_all_notifications_read(db, user)}


@router.patch("/notifications/{notification_id}/read")
def read_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    return notification_service.mark_notification_read(db, user, notification_id)


@router.post("/me/change-password", status_code=204)
def change_my_password(
    payload: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    account_service.change_password(db, user, payload.current_password, payload.new_password, _ip(request))


@router.get("/me/sessions", response_model=list[SessionOut])
def list_my_sessions(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
    x_refresh_token: Optional[str] = Header(default=None),
):
    return account_service.list_sessions(db, user, find_refresh_token(request, x_refresh_token))


@router.delete("/me/sessions/{session_id}", status_code=204)
def revoke_my_session(
    session_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(require_student)
):
    account_service.revoke_session(db, user, session_id, _ip(request))


@router.post("/me/sessions/revoke-others")
def revoke_my_other_sessions(
    payload: RevokeOthersRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    revoked = account_service.revoke_other_sessions(
        db, user, get_refresh_token(request, payload.refresh_token), _ip(request)
    )
    return {"revoked": revoked}


@router.get("/plans")
def list_plan_catalog(db: Session = Depends(get_db), user: User = Depends(require_student)):
    if user.institute_id is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Institute students receive assigned tests and cannot view or purchase plans",
        )
    return plan_service.list_public_plans(db, user)


@router.get("/my-plan")
def my_plan(db: Session = Depends(get_db), user: User = Depends(require_student)):
    return subscription_service.my_current_plan_view(db, user)


@router.post("/plans/{plan_id}/subscribe", status_code=201)
def subscribe_to_plan(
    plan_id: int,
    payload: PlanSubscribeRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    if user.institute_id is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your institute manages your plan - self-service purchase is only for direct students",
        )
    return payment_service.create_user_plan_payment(db, user.id, plan_id, payload.coupon_code, None, _ip(request))


@router.get("/attempts")
def list_attempts(db: Session = Depends(get_db), user: User = Depends(require_student)):
    return attempt_service.list_my_attempts(db, user)


@router.get("/attempts/{attempt_id}")
def get_attempt(
    attempt_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
    session: UserSession = Depends(get_current_session),
    x_attempt_token: Optional[str] = Header(default=None),
):
    attempt = attempt_service.get_attempt_or_404(db, user, attempt_id)
    authorized = attempt_service.security_access_valid(attempt, session, x_attempt_token)
    return attempt_service.get_student_view(db, attempt, security_authorized=authorized)


@router.get("/attempts/{attempt_id}/parts/{part_id}")
def get_attempt_part(
    attempt_id: int,
    part_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
    session: UserSession = Depends(get_current_session),
    x_attempt_token: Optional[str] = Header(default=None),
):
    attempt = attempt_service.get_attempt_or_404(db, user, attempt_id)
    attempt_service.require_security_access(attempt, session, x_attempt_token)
    attempt_service.require_live_security(attempt)
    return attempt_service.get_attempt_part_view(attempt, part_id)


@router.get("/attempts/{attempt_id}/analysis")
def get_attempt_analysis(attempt_id: int, db: Session = Depends(get_db), user: User = Depends(require_student)):
    attempt = attempt_service.get_attempt_or_404(db, user, attempt_id)
    return student_analysis_service.result_analysis(db, attempt)


@router.post("/attempts/{attempt_id}/reevaluation", status_code=201)
def request_reevaluation(
    attempt_id: int,
    payload: ReevaluationCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    attempt = attempt_service.get_attempt_or_404(db, user, attempt_id)
    return grading_service.request_reevaluation(db, user, attempt, payload.reason)


@router.post("/modules/{module_id}/attempts", status_code=201)
def start_attempt(
    module_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
    module: ExamModule = Depends(require_module_access),
):
    return attempt_service.start_attempt(db, user, module)


@router.post("/attempts/{attempt_id}/security/preflight")
def final_test_preflight(
    attempt_id: int,
    payload: FinalTestPreflightRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
    session: UserSession = Depends(get_current_session),
):
    attempt = attempt_service.get_attempt_or_404(db, user, attempt_id)
    return attempt_service.secure_preflight(db, attempt, session, payload.model_dump(), _ip(request))


@router.post("/attempts/{attempt_id}/security/begin")
def begin_final_test(
    attempt_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
    session: UserSession = Depends(get_current_session),
    x_attempt_token: Optional[str] = Header(default=None),
):
    attempt = attempt_service.get_attempt_or_404(db, user, attempt_id)
    return attempt_service.begin_secure_attempt(db, attempt, session, x_attempt_token)


@router.post("/attempts/{attempt_id}/security/heartbeat")
def final_test_heartbeat(
    attempt_id: int,
    payload: FinalTestHeartbeatRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
    session: UserSession = Depends(get_current_session),
    x_attempt_token: Optional[str] = Header(default=None),
):
    attempt = attempt_service.get_attempt_or_404(db, user, attempt_id)
    return attempt_service.record_heartbeat(
        db,
        attempt,
        session,
        x_attempt_token,
        payload.model_dump(),
        _ip(request),
    )


@router.put("/attempts/{attempt_id}/answers/{question_id}")
def save_answer(
    attempt_id: int,
    question_id: int,
    payload: AnswerSaveRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
    session: UserSession = Depends(get_current_session),
    x_attempt_token: Optional[str] = Header(default=None),
):
    attempt = attempt_service.get_attempt_or_404(db, user, attempt_id)
    attempt_service.require_security_access(attempt, session, x_attempt_token)
    attempt_service.require_live_security(attempt)
    return attempt_service.save_answer(db, attempt, question_id, payload.response, payload.revision)


@router.post("/attempts/{attempt_id}/answers/{question_id}/audio", status_code=201)
async def save_audio_answer(
    attempt_id: int,
    question_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
    session: UserSession = Depends(get_current_session),
    x_attempt_token: Optional[str] = Header(default=None),
):
    attempt = attempt_service.get_attempt_or_404(db, user, attempt_id)
    attempt_service.require_security_access(attempt, session, x_attempt_token)
    attempt_service.require_live_security(attempt)
    content, extension = await read_validated_speaking_answer(file)
    return attempt_service.save_audio_answer(db, attempt, question_id, content, extension)


@router.post("/attempts/{attempt_id}/flags", status_code=201)
def record_flag(
    attempt_id: int,
    payload: ProctorFlagRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
    session: UserSession = Depends(get_current_session),
    x_attempt_token: Optional[str] = Header(default=None),
):
    if payload.flag_type not in ATTEMPT_FLAG_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown flag type")
    attempt = attempt_service.get_attempt_or_404(db, user, attempt_id)
    attempt_service.require_security_access(attempt, session, x_attempt_token)
    return attempt_service.record_flag(
        db,
        attempt,
        payload.flag_type,
        payload.meta,
        payload.client_sequence,
        payload.client_occurred_at,
    )


@router.post("/attempts/{attempt_id}/submit")
def submit_attempt(
    attempt_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
    session: UserSession = Depends(get_current_session),
    x_attempt_token: Optional[str] = Header(default=None),
):
    attempt = attempt_service.get_attempt_or_404(db, user, attempt_id)
    attempt_service.require_security_access(attempt, session, x_attempt_token)
    return attempt_service.submit_attempt(db, attempt)


@router.get("/achievements")
def achievements(db: Session = Depends(get_db), user: User = Depends(require_student)):
    return achievement_service.list_student_badges(db, user)


@router.get("/leaderboard")
def leaderboard(db: Session = Depends(get_db), user: User = Depends(require_student)):
    return achievement_service.student_leaderboard(db, user)
