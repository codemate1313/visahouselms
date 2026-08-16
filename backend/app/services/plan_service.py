from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.audit_log import AuditLog
from app.models.exam_module import ExamModule
from app.models.plan import AUDIENCE_DIRECT, AUDIENCE_INSTITUTES, AUDIENCES, Plan
from app.models.subscription import Subscription
from app.models.user import User
from app.services import settings_service


MAX_FEATURE_LENGTH = 120

# Whether each catalogue is listed on the public pricing page. Direct-student
# plans have always been public, institute plans have not - so the stored
# defaults preserve that behaviour until the Super Admin says otherwise.
LANDING_VISIBILITY_KEYS = {
    AUDIENCE_DIRECT: "landing_plans.show_direct",
    AUDIENCE_INSTITUTES: "landing_plans.show_institutes",
}
LANDING_VISIBILITY_DEFAULTS = {AUDIENCE_DIRECT: True, AUDIENCE_INSTITUTES: False}


def _clean_features(features: Optional[List[str]]) -> List[str]:
    """Trim, drop blanks and cap length - these strings land verbatim on the
    public pricing card."""
    if not features:
        return []
    return [item.strip()[:MAX_FEATURE_LENGTH] for item in features if item and item.strip()]


def _audit(db: Session, actor: User, action: str, plan_id: Optional[int], ip: Optional[str], details=None) -> None:
    db.add(
        AuditLog(
            user_id=actor.id,
            action=action,
            entity_type="plan",
            entity_id=plan_id,
            details=details,
            ip_address=ip,
        )
    )


def list_plans(db: Session, audience: Optional[str] = None) -> List[dict]:
    """Plans in one catalogue. `audience` is required in practice - the two
    catalogues are independent, and every screen lists exactly one of them."""
    query = db.query(Plan).filter(Plan.is_internal.is_(False))
    if audience is not None:
        if audience not in AUDIENCES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown plan audience '{audience}'",
            )
        query = query.filter(Plan.audience == audience)
    plans = query.order_by(Plan.created_at).all()
    counts = {
        plan_id: count
        for plan_id, count in (
            db.query(Subscription.plan_id, func.count(Subscription.id))
            .group_by(Subscription.plan_id)
            .all()
        )
    }
    return [_serialize(plan, counts.get(plan.id, 0)) for plan in plans]


def _serialize(plan: Plan, subscription_count: Optional[int] = None) -> dict:
    data = {
        "id": plan.id,
        "name": plan.name,
        "description": plan.description,
        "price": str(plan.price),
        "currency": plan.currency,
        "duration_days": plan.duration_days,
        "student_limit": plan.student_limit,
        "staff_limit": plan.staff_limit,
        "grace_days": plan.grace_days,
        "is_active": plan.is_active,
        "audience": plan.audience,
        "is_published": plan.is_published,
        "is_internal": plan.is_internal,
        "is_international_enabled": plan.is_international_enabled,
        "usd_price": str(plan.usd_price) if plan.usd_price is not None else None,
        "features": list(plan.features or []),
        "ai_evaluation_limit": plan.ai_evaluation_limit,

        "created_at": plan.created_at,
        "gst_rate_id": plan.gst_rate_id,
        "gst_rate": {
            "id": plan.gst_rate.id,
            "name": plan.gst_rate.name,
            "percentage": float(plan.gst_rate.percentage),
            "tax_type": plan.gst_rate.tax_type,
        } if plan.gst_rate else None,
        "module_count": len(plan.modules),

        "modules": [
            {
                "id": module.id,
                "title": module.title,
                "module_type": module.module_type,
                "duration_minutes": module.duration_minutes,
                "status": module.status,
                "is_visible": module.is_visible,
            }
            for module in plan.modules
        ],
    }
    if subscription_count is not None:
        data["subscription_count"] = subscription_count
    return data


def _resolve_modules(db: Session, module_ids: List[int]) -> List[ExamModule]:
    if not module_ids:
        return []
    modules = db.query(ExamModule).filter(ExamModule.id.in_(module_ids), ExamModule.deleted_at.is_(None)).all()
    found_ids = {module.id for module in modules}
    missing = [mid for mid in module_ids if mid not in found_ids]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Module id(s) not found: {', '.join(str(m) for m in missing)}",
        )
    not_published = [module.id for module in modules if module.status != "published"]
    if not_published:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only published modules can be added to a plan (not published: {', '.join(str(m) for m in not_published)})",
        )
    return modules


def live_plan_query(db: Session, audience: str = AUDIENCE_DIRECT):
    """A "live" plan is one the public pricing page can actually show. Whether a
    catalogue is listed at all is the Super Admin's call (see
    `get_landing_visibility`); this query only says which plans within a
    catalogue are publishable. It defaults to direct-student plans because the
    "keep one live plan" guard is about the direct catalogue."""
    return db.query(Plan).filter(
        Plan.is_active.is_(True),
        Plan.is_published.is_(True),
        Plan.is_internal.is_(False),
        Plan.audience == audience,
    )


def get_landing_visibility(db: Session) -> dict:
    """Per-catalogue "show this on the public pricing page" flags. Both may be
    off, in which case the page falls back to a contact-us panel."""
    flags = {}
    for audience, key in LANDING_VISIBILITY_KEYS.items():
        stored = settings_service.get_setting(db, key)
        flags[audience] = LANDING_VISIBILITY_DEFAULTS[audience] if stored is None else stored.lower() == "true"
    return flags


def set_landing_visibility(db: Session, actor: User, values: dict, ip: Optional[str] = None) -> dict:
    """Write the flags the Super Admin toggled. Unknown audiences are rejected
    rather than silently ignored, so a typo never looks like a saved setting."""
    unknown = set(values) - set(LANDING_VISIBILITY_KEYS)
    if unknown:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown plan audience '{sorted(unknown)[0]}'",
        )
    # An omitted flag keeps its stored value - only what was sent is written.
    changed = {audience: bool(flag) for audience, flag in values.items() if flag is not None}
    for audience, flag in changed.items():
        settings_service.set_setting(db, LANDING_VISIBILITY_KEYS[audience], "true" if flag else "false")
    _audit(db, actor, "plan.landing_visibility", None, ip, changed)
    db.commit()
    return get_landing_visibility(db)


def _ensure_not_last_live_plan(db: Session, plan: Plan) -> None:
    """The platform must always keep one plan the public pricing page can list,
    so taking the last live plan down is refused rather than silently emptying
    the landing page."""
    is_live = (
        plan.is_active
        and plan.is_published
        and not plan.is_internal
        and plan.audience == AUDIENCE_DIRECT
    )
    if not is_live:
        return
    if live_plan_query(db).filter(Plan.id != plan.id).count() > 0:
        return
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="At least one live plan is required - publish another plan before taking this one down",
    )


def assert_audience(plan: Plan, expected: str) -> None:
    """Guard the boundary between the two catalogues. Internal onboarding plans
    are institute-only by construction and skip the check."""
    if plan.audience == expected:
        return
    detail = (
        "This is a direct-student plan and cannot be assigned to an institute"
        if expected == AUDIENCE_INSTITUTES
        else "This is an institute plan and cannot be purchased by a student directly"
    )
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def get_plan_or_404(db: Session, plan_id: int) -> Plan:
    plan = db.get(Plan, plan_id)
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    return plan


def get_plan(db: Session, plan_id: int) -> dict:
    plan = get_plan_or_404(db, plan_id)
    count = db.query(Subscription).filter(Subscription.plan_id == plan.id).count()
    return _serialize(plan, count)


def build_plan(db: Session, actor: User, data: dict, ip: Optional[str]) -> Plan:
    """Validate and stage a catalogue plan without committing, so a caller that
    is already mid-transaction (institute onboarding authors a plan alongside
    the institute it is for) either gets both rows or neither."""
    if db.query(Plan).filter(Plan.name == data["name"]).first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A plan with this name already exists")

    modules = _resolve_modules(db, data.get("module_ids") or [])
    if data.get("is_published") and not modules:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Add at least one course before publishing the plan")
    plan = Plan(
        name=data["name"],
        description=data.get("description"),
        price=Decimal(str(data["price"])),
        currency=data.get("currency") or "INR",
        duration_days=data["duration_days"],
        student_limit=data["student_limit"],
        staff_limit=data["staff_limit"],
        grace_days=data.get("grace_days", 7),
        is_active=True,
        audience=data.get("audience") or AUDIENCE_DIRECT,
        is_published=data.get("is_published", False),
        # Internal plans back one institute's agreement and stay out of every
        # catalogue listing (see the filter in `list_plans`).
        is_internal=data.get("is_internal", False),
        features=_clean_features(data.get("features")),
        gst_rate_id=data.get("gst_rate_id"),
        is_international_enabled=data.get("is_international_enabled", False),
        usd_price=Decimal(str(data["usd_price"])) if data.get("usd_price") is not None else None,
        ai_evaluation_limit=(data.get("ai_evaluation_limit") or None),
        modules=modules,
    )

    db.add(plan)
    db.flush()
    _audit(db, actor, "plan.create", plan.id, ip, {"name": plan.name})
    return plan


def apply_plan_terms(db: Session, actor: User, plan: Plan, data: dict, ip: Optional[str]) -> Plan:
    """Rewrite an existing plan's terms in place, without committing. Used for a
    plan that backs exactly one institute's agreement: there is no one else on
    it, so editing the agreement edits the plan rather than minting a new one."""
    name = data.get("name")
    if name and name != plan.name:
        if db.query(Plan).filter(Plan.name == name, Plan.id != plan.id).first() is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A plan with this name already exists")
        plan.name = name

    modules = _resolve_modules(db, data.get("module_ids") or [])
    for field in ("description", "currency", "duration_days", "student_limit", "test_limit", "staff_limit", "grace_days", "gst_rate_id", "is_international_enabled"):
        if data.get(field) is not None:
            setattr(plan, field, data[field])
    if data.get("price") is not None:
        plan.price = Decimal(str(data["price"]))
    if data.get("usd_price") is not None:
        plan.usd_price = Decimal(str(data["usd_price"])) if data.get("usd_price") != "" else None
    if data.get("features") is not None:
        plan.features = _clean_features(data["features"])
    if data.get("module_ids") is not None:
        # An empty list is an instruction, not a missing value: the caller took
        # every course off the agreement and the plan must stop granting them.
        plan.modules = modules

    db.add(plan)
    db.flush()
    _audit(db, actor, "plan.update", plan.id, ip, {"name": plan.name})
    return plan


def create_plan(db: Session, actor: User, data: dict, ip: Optional[str]) -> dict:
    plan = build_plan(db, actor, data, ip)
    db.commit()
    db.refresh(plan)
    return _serialize(plan, 0)


def update_plan(db: Session, actor: User, plan_id: int, data: dict, ip: Optional[str]) -> dict:
    plan = get_plan_or_404(db, plan_id)

    if "name" in data and data["name"] is not None and data["name"] != plan.name:
        if db.query(Plan).filter(Plan.name == data["name"], Plan.id != plan.id).first() is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A plan with this name already exists")
        plan.name = data["name"]

    if data.get("is_published") is False:
        _ensure_not_last_live_plan(db, plan)

    new_audience = data.get("audience")
    if new_audience is not None and new_audience != plan.audience:
        # Moving a plan between catalogues would strand whoever is already on
        # it - an institute holding a plan that is suddenly B2C, or vice versa.
        if db.query(Subscription).filter(Subscription.plan_id == plan.id).count() > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This plan has subscriptions and cannot be moved to the other catalogue - create a new plan instead",
            )

    for field in ("description", "currency", "duration_days", "student_limit", "test_limit", "staff_limit", "grace_days", "audience", "is_published", "gst_rate_id", "is_international_enabled"):
        if field in data and data[field] is not None:
            setattr(plan, field, data[field])

    if "price" in data and data["price"] is not None:
        plan.price = Decimal(str(data["price"]))
    if "usd_price" in data:
        plan.usd_price = Decimal(str(data["usd_price"])) if data["usd_price"] is not None and data["usd_price"] != "" else None
    if "ai_evaluation_limit" in data:
        # 0/None both mean "use the platform-wide default" - only positive
        # values override it, mirroring Institute.ai_student_monthly_limit.
        plan.ai_evaluation_limit = data["ai_evaluation_limit"] or None

    if "features" in data and data["features"] is not None:
        plan.features = _clean_features(data["features"])
    if "module_ids" in data and data["module_ids"] is not None:
        plan.modules = _resolve_modules(db, data["module_ids"])
    if plan.is_published and not plan.modules:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Add at least one course before publishing the plan")

    db.add(plan)
    _audit(db, actor, "plan.update", plan.id, ip)
    db.commit()
    db.refresh(plan)
    count = db.query(Subscription).filter(Subscription.plan_id == plan.id).count()
    return _serialize(plan, count)


def set_plan_active(db: Session, actor: User, plan_id: int, active: bool, ip: Optional[str]) -> dict:
    plan = get_plan_or_404(db, plan_id)
    if not active:
        _ensure_not_last_live_plan(db, plan)
    plan.is_active = active
    db.add(plan)
    _audit(db, actor, "plan.activate" if active else "plan.deactivate", plan.id, ip)
    db.commit()
    db.refresh(plan)
    count = db.query(Subscription).filter(Subscription.plan_id == plan.id).count()
    return _serialize(plan, count)


def delete_plan(db: Session, actor: User, plan_id: int, ip: Optional[str]) -> None:
    plan = get_plan_or_404(db, plan_id)
    _ensure_not_last_live_plan(db, plan)
    has_subscriptions = (
        db.query(Subscription).filter(Subscription.plan_id == plan.id).count() > 0
    )
    if has_subscriptions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This plan has subscriptions and cannot be deleted - deactivate it instead",
        )
    _audit(db, actor, "plan.delete", plan.id, ip, {"name": plan.name})
    db.delete(plan)
    db.commit()


def list_available_modules_for_plans(
    db: Session, search: Optional[str] = None, module_type: Optional[str] = None
) -> List[dict]:
    """Cross-instructor listing of published modules for the Super Admin's
    plan-module picker. Deliberately unscoped by created_by_id - unlike
    module_authoring_service.list_modules (author-private), Super Admin needs
    visibility into every instructor's published content to bundle it into a
    plan."""
    query = db.query(ExamModule).filter(ExamModule.status == "published", ExamModule.deleted_at.is_(None))
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(or_(ExamModule.title.ilike(term), ExamModule.description.ilike(term)))
    if module_type:
        query = query.filter(ExamModule.module_type == module_type)
    modules = query.order_by(ExamModule.module_type, ExamModule.title).all()
    return [
        {
            "id": module.id,
            "title": module.title,
            "module_type": module.module_type,
            "duration_minutes": module.duration_minutes,
            "status": module.status,
            "is_visible": module.is_visible,
            "created_by_name": f"{module.created_by.first_name} {module.created_by.last_name}".strip(),
        }
        for module in modules
    ]


MONTHLY_MAX_DAYS = 45
ANNUAL_MIN_DAYS = 300


def _billing_period(duration_days: int) -> str:
    if duration_days <= MONTHLY_MAX_DAYS:
        return "monthly"
    if duration_days >= ANNUAL_MIN_DAYS:
        return "annual"
    return "custom"


def _period_label(plan: Plan) -> str:
    per_student = " / student" if plan.audience == "institutes" else ""
    period = _billing_period(plan.duration_days)
    if period == "monthly":
        return f"{per_student} / month".lstrip()
    if period == "annual":
        return f"{per_student} / year".lstrip()
    return f"{per_student} / {plan.duration_days} days".lstrip()


def _landing_features(plan: Plan, modules: List[dict]) -> List[str]:
    """The Super Admin's authored bullet list wins; plans that predate it (or
    were saved with an empty list) fall back to bullets derived from what the
    plan actually grants, so no pricing card ever renders featureless."""
    authored = _clean_features(plan.features)
    if authored:
        return authored

    features = [module["title"] for module in modules[:4]]
    if len(modules) > 4:
        features.append(f"+{len(modules) - 4} more modules")
    features.append("Unlimited students" if plan.student_limit == 0 else f"Up to {plan.student_limit:,} students")
    # Sittings are per module and per purchase, not a per-cycle allowance, so
    # the old "Unlimited mock tests" line was a claim the product never kept.
    features.append(f"{len(modules)} test{'' if len(modules) == 1 else 's'} included")
    if plan.staff_limit:
        features.append(f"{plan.staff_limit:,} staff seats")
    if plan.grace_days:
        features.append(f"{plan.grace_days}-day grace period")
    return features


def list_landing_plans(db: Session) -> dict:
    """Both catalogues for the unauthenticated marketing pricing page, each
    gated by its own visibility flag. A hidden catalogue comes back empty rather
    than omitted, so the page can render its audience switch from the flags
    alone. No entitlement data, since there is no session."""
    visibility = get_landing_visibility(db)
    counts = _subscription_counts(db)
    return {
        "show_direct": visibility[AUDIENCE_DIRECT],
        "show_institutes": visibility[AUDIENCE_INSTITUTES],
        AUDIENCE_DIRECT: _landing_group(db, AUDIENCE_DIRECT, counts) if visibility[AUDIENCE_DIRECT] else [],
        AUDIENCE_INSTITUTES: _landing_group(db, AUDIENCE_INSTITUTES, counts) if visibility[AUDIENCE_INSTITUTES] else [],
    }


def _subscription_counts(db: Session) -> dict:
    return {
        plan_id: count
        for plan_id, count in (
            db.query(Subscription.plan_id, func.count(Subscription.id))
            .group_by(Subscription.plan_id)
            .all()
        )
    }


def _landing_group(db: Session, audience: str, counts: dict) -> List[dict]:
    """One catalogue's published, active, non-internal plans as pricing cards."""
    plans = live_plan_query(db, audience).options(joinedload(Plan.modules)).order_by(Plan.price).all()

    result = []
    for plan in plans:
        modules = [
            {"id": module.id, "title": module.title, "module_type": module.module_type}
            for module in plan.modules
            if module.status == "published" and module.is_visible
        ]
        result.append(
            {
                "id": plan.id,
                "name": plan.name,
                "description": plan.description,
                "price": str(plan.price),
                "currency": plan.currency,
                "is_international_enabled": plan.is_international_enabled,
                "usd_price": str(plan.usd_price) if plan.usd_price is not None else None,
                "duration_days": plan.duration_days,
                "audience": plan.audience,
                "billing_period": _billing_period(plan.duration_days),
                "period_label": _period_label(plan),
                "modules": modules,
                "features": _landing_features(plan, modules),
                "subscription_count": counts.get(plan.id, 0),
            }
        )

    # "Most popular" is earned by subscriber count; with no subscribers yet the
    # middle card carries the badge so the layout still has a focal point.
    if result:
        top = max(result, key=lambda item: item["subscription_count"])
        popular = top if top["subscription_count"] > 0 else result[len(result) // 2]
        for item in result:
            item["is_popular"] = item is popular

    return result


def held_plan_ids(db: Session, user_id: int) -> set:
    """Plan ids this student has paid for and not yet used up.

    Deliberately includes a term that has not started yet. Buying a plan while
    another is running stacks the new term onto the end of the old one, so it
    sits in the future - and skipping those meant a plan the student had paid
    for seconds earlier still rendered a "Choose plan" button. They could buy
    the same plan over and over and the catalogue would never notice.

    Grace is counted as held: the term is still theirs while a renewal clears.
    """
    now = datetime.utcnow()
    rows = (
        db.query(Subscription)
        .filter(Subscription.user_id == user_id, Subscription.cancelled_at.is_(None))
        .all()
    )
    return {
        row.plan_id
        for row in rows
        if now <= row.expires_at + timedelta(days=row.grace_days or 0)
    }


def held_plan_expiry(db: Session, user_id: int) -> dict:
    """When each held plan runs out, so a card can say "active until 14 Nov"."""
    now = datetime.utcnow()
    rows = (
        db.query(Subscription)
        .filter(Subscription.user_id == user_id, Subscription.cancelled_at.is_(None))
        .all()
    )
    ends: dict = {}
    for row in rows:
        cutoff = row.expires_at + timedelta(days=row.grace_days or 0)
        if now > cutoff:
            continue
        current = ends.get(row.plan_id)
        if current is None or row.expires_at > current:
            ends[row.plan_id] = row.expires_at
    return ends


# Kept as the old name so nothing else has to change; the meaning is now
# "held", which is what every caller actually wanted.
_live_user_plan_ids = held_plan_ids


def assert_plan_not_already_held(db: Session, user_id: int, plan_id: int) -> None:
    """Deliberately a no-op.

    Buying a plan again is allowed and always adds: its days stack onto every
    module it contains, and each purchase hands over another sitting. Blocking
    the repeat sale would have meant a student who wanted 30 more days and one
    more attempt had no way to pay for them.

    The catalogue still marks a held plan as PURCHASED with its end date - that
    is information, not a gate.
    """
    return None


def list_public_plans(db: Session, user: User) -> List[dict]:
    """Active plans with each plan's module bundle plus whether this student
    (institute-linked or direct/B2C) is currently entitled to it."""
    from app.services.subscription_service import (  # local import: avoids a
        STATE_ACTIVE,  # circular import, since subscription_service already
        STATE_GRACE,  # imports plan_service.get_plan_or_404
        current_subscription,
        current_user_subscription,
    )

    visibility = get_landing_visibility(db)
    if not visibility.get(AUDIENCE_DIRECT, True):
        return []

    held_expiry = (
        held_plan_expiry(db, user.id) if user.institute_id is None else {}
    )

    if user.institute_id is not None:
        subscription, state = current_subscription(db, user.institute_id)
        entitled_plan_ids = (
            {subscription.plan_id}
            if subscription and state in (STATE_ACTIVE, STATE_GRACE)
            else set()
        )
    else:
        # Every plan the student currently holds, not just the single governing
        # term. `current_user_subscription` returns one winner - the longest-
        # dated started subscription - which is correct for deciding access, but
        # wrong for "which of these cards have I bought". A student holding a
        # long institute-style term alongside a short direct plan had the long
        # one win, so the plan they had just paid for came back as not entitled
        # and still showed a "Choose plan" button.
        entitled_plan_ids = held_plan_ids(db, user.id)

    plans = (
        db.query(Plan)
        .options(joinedload(Plan.modules))
        .filter(
            Plan.is_active.is_(True),
            Plan.is_published.is_(True),
            Plan.audience == AUDIENCE_DIRECT,
        )
        .order_by(Plan.price)
        .all()
    )
    result = []
    for plan in plans:
        data = _serialize(plan)
        data["modules"] = [module for module in data["modules"] if module["status"] == "published" and module["is_visible"]]
        data["module_count"] = len(data["modules"])
        data["entitled"] = plan.id in entitled_plan_ids
        # So the card can say when it runs out rather than only that it is held -
        # a student who cannot see an end date has no idea when to renew.
        expiry = held_expiry.get(plan.id)
        data["entitled_until"] = expiry.isoformat() if expiry is not None else None
        result.append(data)
    return result
