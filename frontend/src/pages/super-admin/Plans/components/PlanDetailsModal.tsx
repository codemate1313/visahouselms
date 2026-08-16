import { createPortal } from "react-dom";
import { Icon } from "@/components/icons";
import { formatCurrencyAmount } from "@/utils/currency";
import { plansStrings as strings } from "../Plans.strings";
import type { PlanRow } from "../types";
import { Badge, LinkButton } from "@/components/ui";
import { CATALOGUE_STATUS_LABELS } from "@/constants";

interface PlanDetailsModalProps {
  plan: PlanRow;
  onClose: () => void;
}

export function PlanDetailsModal({ plan, onClose }: PlanDetailsModalProps) {
  const t = strings.detailsModal;
  return createPortal(
    <div className="plan-dialog-backdrop" onClick={onClose}>
      <div className="plan-dialog-card" onClick={(e) => e.stopPropagation()}>
        <div className="plan-dialog-header">
          <div className="plan-dialog-header-left">
            <div className="plan-dialog-icon">
              <Icon name="plan" />
            </div>
            <div>
              <div className="plan-dialog-title-row">
                <h2 className="plan-dialog-title">{plan.name}</h2>
                <Badge tone={!plan.is_active ? "inactive" : plan.is_published ? "green" : "amber"}>
                  {!plan.is_active
                    ? CATALOGUE_STATUS_LABELS.inactive
                    : plan.is_published
                      ? CATALOGUE_STATUS_LABELS.active
                      : CATALOGUE_STATUS_LABELS.draft}
                </Badge>
              </div>
              <span className="plan-dialog-price">
                {formatCurrencyAmount(plan.price, plan.currency)}
                {plan.is_international_enabled && plan.usd_price && (
                  <span style={{ fontSize: 13, marginLeft: 8, color: "#2563eb", fontWeight: 700 }}>
                    | ${plan.usd_price} USD (Intl)
                  </span>
                )}
                <small> / {plan.duration_days} {t.billingCycleSuffix}</small>
              </span>

            </div>
          </div>
          <button type="button" className="plan-dialog-close" onClick={onClose} title={t.closeModalTitle}>
            <Icon name="x" />
          </button>
        </div>

        <div className="plan-dialog-body">
          {plan.description && (
            <div className="plan-dialog-section">
              <label className="plan-dialog-label">{t.overviewLabel}</label>
              <p className="plan-dialog-desc">{plan.description}</p>
            </div>
          )}

          <div className="plan-dialog-grid">
            <div className="plan-metric-card metric-students">
              <div className="plan-metric-icon">
                <Icon name="user" />
              </div>
              <div className="plan-metric-info">
                <span className="plan-metric-label">{t.studentLimit}</span>
                <strong className="plan-metric-val">
                  {plan.student_limit.toLocaleString()} {t.studentsSuffix}
                </strong>
              </div>
            </div>

            <div className="plan-metric-card metric-staff">
              <div className="plan-metric-icon">
                <Icon name="admin" />
              </div>
              <div className="plan-metric-info">
                <span className="plan-metric-label">{t.staffLimit}</span>
                <strong className="plan-metric-val">
                  {plan.staff_limit.toLocaleString()} {t.staffSuffix}
                </strong>
              </div>
            </div>

            <div className="plan-metric-card metric-grace">
              <div className="plan-metric-icon">
                <Icon name="due" />
              </div>
              <div className="plan-metric-info">
                <span className="plan-metric-label">{t.gracePeriod}</span>
                <strong className="plan-metric-val">
                  {plan.grace_days} {t.graceSuffix}
                </strong>
              </div>
            </div>

            <div className="plan-metric-card metric-courses">
              <div className="plan-metric-icon">
                <Icon name="courses" />
              </div>
              <div className="plan-metric-info">
                <span className="plan-metric-label">{t.assignedCourses}</span>
                <strong className="plan-metric-val">
                  {plan.module_count} {t.coursesSuffix}
                </strong>
              </div>
            </div>

            <div className="plan-metric-card metric-subs">
              <div className="plan-metric-icon">
                <Icon name="subscription" />
              </div>
              <div className="plan-metric-info">
                <span className="plan-metric-label">{t.activeSubscriptions}</span>
                <strong className="plan-metric-val">
                  {plan.subscription_count} {t.subscribersSuffix}
                </strong>
              </div>
            </div>
          </div>

          <div className="plan-dialog-meta">
            <div>
              <span style={{ color: "var(--text-muted)" }}>{t.targetAudience} </span>
              <strong style={{ textTransform: "capitalize", color: "var(--text)" }}>{plan.audience.replace("_", " ")}</strong>
            </div>
            <div>
              <span style={{ color: "var(--text-muted)" }}>{t.publishStatus} </span>
              <strong style={{ color: "var(--text)" }}>{plan.is_published ? t.published : t.draft}</strong>
            </div>
          </div>
        </div>

        <div className="plan-dialog-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            {t.close}
          </button>
          <LinkButton to={`/super-admin/plans/${plan.id}`} onClick={onClose}>
            {t.editPlan}
          </LinkButton>
        </div>
      </div>
    </div>,
    document.body
  );
}
