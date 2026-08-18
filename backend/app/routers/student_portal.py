import time
from copy import deepcopy
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, Request, UploadFile, status
from starlette.concurrency import run_in_threadpool

from sqlalchemy.orm import Session

from app.config import settings
from app.core.uploads import read_validated_speaking_answer
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
    DailyEnglishAnswerRequest,
    FinalTestHeartbeatRequest,
    FinalTestPreflightRequest,
    PlanSubscribeRequest,
    ProctorFlagRequest,
    ReevaluationCreateRequest,
    RetakeRequestCreate,
)
from app.schemas.user import ChangePasswordRequest, ProfileUpdateRequest, SessionOut
from app.services import (
    account_service,
    achievement_service,
    attempt_service,
    avatar_service,
    exam_news_service,
    coupon_service,
    currency_conversion_service,
    grading_service,
    module_blueprint_service,
    notification_service,
    payment_service,
    plan_service,
    retake_service,
    student_analysis_service,
    subscription_service,
    daily_english_service,
    english_discovery_service,
    ai_evaluation_service,
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
        institute_slug=user.institute.slug if user.institute else None,
        first_name=user.first_name,
        last_name=user.last_name,
        force_password_reset=user.force_password_reset,
        avatar_url=account_service.avatar_url_for(user),
        is_owner=user.is_owner,
        is_developer_verified=user.is_developer_verified,
        dob=user.dob,
        phone_number=user.phone_number,
        address=user.address,
        gender=user.gender,
    )


@router.get("/daily-english")
def get_daily_english_challenge(
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    return daily_english_service.get_daily_challenge(db, user)


@router.post("/daily-english/answer")
def answer_daily_english_question(
    payload: DailyEnglishAnswerRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    return daily_english_service.answer_daily_question(
        db,
        user,
        payload.question_id,
        payload.answer_index,
    )


@router.get("/english-discovery")
def get_english_discovery(
    exclude_page_ids: Optional[str] = Query(default=None, max_length=300),
):
    excluded: set[int] = set()
    if exclude_page_ids:
        try:
            excluded = {
                int(value)
                for value in exclude_page_ids.split(",")
                if value.strip()
            }
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid excluded page IDs",
            ) from exc
    return english_discovery_service.get_random_english_fact(excluded)


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
    updated = account_service.update_profile(
        db,
        user,
        payload.email,
        payload.first_name,
        payload.last_name,
        _ip(request),
        dob=payload.dob,
        phone_number=payload.phone_number,
        address=payload.address,
        gender=payload.gender,
    )
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


@router.post("/me/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_my_password(
    payload: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    if user.force_password_reset:
        account_service.set_initial_password(db, user, payload.new_password, _ip(request))
        return
    account_service.change_password(db, user, payload.current_password, payload.new_password, _ip(request))


@router.get("/me/sessions", response_model=list[SessionOut])
def list_my_sessions(
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
    current_session: UserSession = Depends(get_current_session),
):
    return account_service.list_sessions(db, user, current_session.id)


@router.delete("/me/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_my_session(
    session_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(require_student)
):
    account_service.revoke_session(db, user, session_id, _ip(request))


@router.post("/me/sessions/revoke-others")
def revoke_my_other_sessions(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
    current_session: UserSession = Depends(get_current_session),
):
    revoked = account_service.revoke_other_sessions(
        db, user, current_session.id, _ip(request)
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


@router.get("/exam-news")
def exam_news(user: User = Depends(require_student)):
    """Curated exam & immigration updates for the student dashboard."""
    return exam_news_service.list_exam_news()


@router.get("/ai-evaluations/history")
def get_ai_evaluation_history(db: Session = Depends(get_db), user: User = Depends(require_student)):
    return ai_evaluation_service.get_student_ai_evaluation_history(db, user)


from app.core.geo_ip import detect_country_code


class VerifyRazorpayRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str


class VerifyStripeRequest(BaseModel):
    payment_intent_id: str


class CreateOrderRequest(BaseModel):
    coupon_code: Optional[str] = None
    currency: Optional[str] = None


class ValidateCouponRequest(BaseModel):
    coupon_code: str
    currency: Optional[str] = None


@router.get("/detect-location")
def get_detected_location(request: Request):
    country_code = detect_country_code(request)
    response = {
        "country": country_code,
        "default_currency": "INR" if country_code == "IN" else "USD",
        "gateway": "razorpay" if country_code == "IN" else "stripe",
    }
    if country_code != "IN":
        response["conversion"] = currency_conversion_service.get_inr_usd_display_rate()
    return response


@router.get("/payment-config")
def get_payment_config(db: Session = Depends(get_db)):
    return payment_service.get_public_payment_config(db)


@router.post("/plans/{plan_id}/validate-coupon")
def validate_plan_coupon(
    plan_id: int,
    payload: ValidateCouponRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    plan = plan_service.get_plan_or_404(db, plan_id)
    requested_currency = (payload.currency or plan.currency or "INR").upper()
    is_usd = requested_currency == "USD" and plan.is_international_enabled and plan.usd_price is not None
    effective_base_price = Decimal(str(plan.usd_price if is_usd else plan.price))

    discount, coupon = coupon_service.validate_and_price(db, payload.coupon_code, effective_base_price, "plan", plan_id, user.email)

    discounted_base = max(Decimal("0.00"), effective_base_price - discount)

    gst = None if is_usd else plan.gst_rate
    gst_amount = Decimal("0.00")
    subtotal = discounted_base
    final_total = discounted_base

    if gst and gst.percentage > 0:
        if gst.tax_type == "inclusive":
            final_total = discounted_base
            subtotal = (final_total / (1 + Decimal(str(gst.percentage)) / Decimal("100"))).quantize(Decimal("0.01"))
            gst_amount = final_total - subtotal
        else:
            subtotal = discounted_base
            gst_amount = (subtotal * (Decimal(str(gst.percentage)) / Decimal("100"))).quantize(Decimal("0.01"))
            final_total = subtotal + gst_amount

    return {
        "valid": True,
        "coupon_code": coupon.code if coupon else payload.coupon_code,
        "discount_amount": float(discount),
        "discount_type": coupon.discount_type if coupon else None,
        "discount_value": float(coupon.value) if coupon else None,
        "discounted_base_price": float(discounted_base),
        "subtotal": float(subtotal),
        "gst_amount": float(gst_amount),
        "final_total": float(final_total),
    }


@router.post("/plans/{plan_id}/create-order", status_code=status.HTTP_201_CREATED)
def create_plan_order(
    plan_id: int,
    payload: CreateOrderRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    if user.institute_id is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your institute manages your plan - self-service purchase is only for direct students",
        )
    return payment_service.create_user_plan_order(db, user.id, plan_id, payload.coupon_code, _ip(request), payload.currency)


@router.post("/payments/{payment_id}/verify-stripe")
def verify_stripe_payment(
    payment_id: int,
    payload: VerifyStripeRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    if user.institute_id is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Institute students do not have direct billing payments",
        )
    return payment_service.verify_stripe_payment(
        db, user.id, payment_id, payload.payment_intent_id, _ip(request)
    )


@router.post("/payments/{payment_id}/verify-razorpay")
def verify_razorpay_payment(
    payment_id: int,
    payload: VerifyRazorpayRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    if user.institute_id is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Institute students do not have direct billing payments",
        )
    return payment_service.verify_razorpay_payment(
        db, user.id, payment_id, payload.razorpay_payment_id, payload.razorpay_order_id, payload.razorpay_signature, _ip(request)
    )



@router.post("/plans/{plan_id}/subscribe", status_code=status.HTTP_201_CREATED)
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


@router.get("/payments")
def list_my_payments(db: Session = Depends(get_db), user: User = Depends(require_student)):
    if user.institute_id is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Institute students do not have direct billing history",
        )
    return payment_service.list_user_payments(db, user.id)


@router.get("/payments/{payment_id}")
def get_my_payment_invoice(
    payment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    if user.institute_id is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Institute students do not have direct billing invoices",
        )
    return payment_service.get_user_payment_invoice(db, user.id, payment_id)




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


@router.post("/attempts/{attempt_id}/reevaluation", status_code=status.HTTP_201_CREATED)
def request_reevaluation(
    attempt_id: int,
    payload: ReevaluationCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    attempt = attempt_service.get_attempt_or_404(db, user, attempt_id)
    return grading_service.request_reevaluation(db, user, attempt, payload.reason)


@router.post("/attempts/{attempt_id}/retake-request", status_code=status.HTTP_201_CREATED)
def request_retake(
    attempt_id: int,
    payload: RetakeRequestCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    attempt = attempt_service.get_attempt_or_404(db, user, attempt_id)
    return retake_service.request_retake(db, user, attempt, payload.reason)


@router.post("/modules/{module_id}/attempts", status_code=status.HTTP_201_CREATED)
def start_attempt(
    module_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
    module: ExamModule = Depends(require_module_access),
):
    return attempt_service.start_attempt(db, user, module)


@router.post("/attempts/{attempt_id}/commence")
def commence_attempt(
    attempt_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    attempt = attempt_service.get_attempt_or_404(db, user, attempt_id)
    return attempt_service.commence_attempt(db, user, attempt)


@router.post("/attempts/{attempt_id}/cancel-onboarding")
def cancel_onboarding(
    attempt_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    return attempt_service.cancel_onboarding_attempt(db, user, attempt_id)



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


@router.post("/attempts/{attempt_id}/answers/{question_id}/audio", status_code=status.HTTP_201_CREATED)
async def save_audio_answer(
    attempt_id: int,
    question_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
    session: UserSession = Depends(get_current_session),
    x_attempt_token: Optional[str] = Header(default=None),
):
    started_at = time.monotonic()
    attempt = attempt_service.get_attempt_or_404(db, user, attempt_id)
    attempt_service.require_security_access(attempt, session, x_attempt_token)
    attempt_service.require_live_security(attempt)
    content, extension = await read_validated_speaking_answer(file)
    result = attempt_service.save_audio_answer(db, attempt, question_id, content, extension)
    # Waiting for a recording to reach the server is not answering time. Measured
    # rather than estimated, so a slow connection is compensated properly, and
    # keyed on the question so a retried upload cannot be credited twice.
    attempt_service.credit_clock(
        db, attempt, f"upload:{question_id}", time.monotonic() - started_at
    )
    result["expires_at"] = attempt.expires_at
    return result


@router.post("/attempts/{attempt_id}/flags", status_code=status.HTTP_201_CREATED)
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
    auto: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
    session: UserSession = Depends(get_current_session),
    x_attempt_token: Optional[str] = Header(default=None),
):
    attempt = attempt_service.get_attempt_or_404(db, user, attempt_id)
    attempt_service.require_security_access(attempt, session, x_attempt_token)
    return attempt_service.submit_attempt(db, attempt, require_complete_speaking=not auto)


@router.get("/achievements")
def achievements(db: Session = Depends(get_db), user: User = Depends(require_student)):
    return achievement_service.list_student_badges(db, user)


@router.get("/leaderboard")
def leaderboard(
    scope: str = "institute",
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    return achievement_service.student_leaderboard(db, user, scope=scope)


@router.get("/speaking-examiners")
def list_speaking_examiners():
    return avatar_service.list_examiners()


@router.get("/attempts/{attempt_id}/speaking-avatar/{part_id}")
async def get_speaking_avatar_for_attempt_part(
    attempt_id: int,
    part_id: int,
    examiner_id: Optional[str] = None,
    question_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
    session: UserSession = Depends(get_current_session),
    x_attempt_token: Optional[str] = Header(default=None),
):
    attempt = attempt_service.get_attempt_or_404(db, user, attempt_id)
    attempt_service.require_security_access(attempt, session, x_attempt_token)

    part_view = attempt_service.get_attempt_part_view(attempt, part_id)
    part_data = part_view
    questions = part_view.get("questions", [])

    prompt_text = part_data.get("instructions") or part_data.get("title") or "Listen to the examiner prompt and record your response."
    # No question_id is the part introduction, and it must stay the part's own
    # instructions. Falling back to questions[0] here made the introduction
    # speak the first prompt instead - and because prompt audio is cached by a
    # hash of its text, the first question then resolved to the very same file.
    # The player saw an unchanged URL, never replayed it, and the examiner went
    # silent for that question and every one after it.
    selected_question = (
        next((question for question in questions if question.get("id") == question_id), None)
        if question_id is not None
        else None
    )
    if selected_question and selected_question.get("prompt"):
        prompt_text = selected_question["prompt"]

    interaction = (selected_question or {}).get("interaction") or {}
    if selected_question and interaction.get("adaptive_follow_up"):
        questions_by_order = list(questions)
        selected_index = next(
            (index for index, question in enumerate(questions_by_order) if question.get("id") == selected_question.get("id")),
            -1,
        )
        if selected_index > 0:
            previous_question = questions_by_order[selected_index - 1]
            previous_answer = next(
                (answer for answer in attempt.answers if answer.question_id == previous_question.get("id")),
                None,
            )
            if previous_answer and previous_answer.audio_path:
                result = await run_in_threadpool(
                    ai_evaluation_service.generate_speaking_follow_up,
                    db,
                    audio_path=settings.storage_path / previous_answer.audio_path,
                    current_prompt=str(previous_question.get("prompt") or ""),
                    next_prompt=prompt_text,
                    next_turn_type=str(interaction.get("turn_type") or "follow_up"),
                )
                prompt_text = result["next_prompt"]
                if result["generated"]:
                    snapshot = deepcopy(attempt.content_snapshot or {})
                    frozen = (
                        snapshot.get("parts", {})
                        .get(str(part_id), {})
                        .get("questions", {})
                        .get(str(selected_question["id"]))
                    )
                    if frozen is not None:
                        frozen["runtime_prompt"] = prompt_text
                        attempt.content_snapshot = snapshot
                        db.add(attempt)
                        db.commit()

    # Candidate delivery always uses Sonia. Keep the legacy query parameter for
    # backward-compatible clients, but never let it change the examiner.
    examiner = avatar_service.get_examiner()
    audio_url, visemes, duration = await avatar_service.get_or_create_prompt_audio(prompt_text, examiner["voice"])

    # A Speaking 2 prompt can carry a heading the examiner announces first - the
    # role-play situation - and pauses after before asking. It is voiced as its
    # own clip rather than glued to the front of the prompt: the pause between
    # them is authored in seconds, and a single clip would have to bake it into
    # the audio, so changing it would mean re-synthesising the whole prompt.
    heading_text = str((interaction or {}).get("heading") or "").strip()
    heading_audio_url = None
    heading_visemes: list = []
    heading_duration = 0.0
    heading_gap_seconds = 0
    if heading_text:
        heading_audio_url, heading_visemes, heading_duration = await avatar_service.get_or_create_prompt_audio(
            heading_text, examiner["voice"]
        )
        part_constraints = part_data.get("answer_constraints") or {}
        configured_gap = interaction.get("heading_gap_seconds")
        heading_gap_seconds = int(
            configured_gap
            if configured_gap is not None
            else part_constraints.get("default_heading_gap_seconds", module_blueprint_service.DEFAULT_HEADING_GAP_SECONDS)
        )

    # The candidate cannot answer until the examiner has finished speaking, so
    # that time is credited back to the countdown - the heading and the pause
    # after it included, since neither is time the candidate can use. Keyed on
    # the question, so replaying this request cannot buy more than the one
    # prompt's worth.
    credit_key = f"prompt:{selected_question['id']}" if selected_question else f"part-intro:{part_id}"
    attempt_service.credit_clock(
        db,
        attempt,
        credit_key,
        duration + heading_duration + heading_gap_seconds + attempt_service.CLOCK_TRANSITION_ALLOWANCE_SECONDS,
    )

    return {
        "examiner": examiner,
        "prompt_text": prompt_text,
        "audio_url": audio_url,
        "video_url": None,
        "expires_at": attempt.expires_at,
        "duration": duration,
        "visemes": visemes,
        "heading_text": heading_text or None,
        "heading_audio_url": heading_audio_url,
        "heading_duration": heading_duration,
        "heading_visemes": heading_visemes,
        "heading_gap_seconds": heading_gap_seconds,
    }
