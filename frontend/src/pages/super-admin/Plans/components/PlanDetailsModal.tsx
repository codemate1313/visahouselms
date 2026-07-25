import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Icon } from "@/components/icons";
import { plansStrings as strings } from "../Plans.strings";
import type { PlanRow } from "../types";

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
                <span className={`badge ${!plan.is_active ? "badge-inactive" : plan.is_published ? "badge-green" : "badge-amber"}`}>
                  {!plan.is_active ? strings.statusFilter.inactive : plan.is_published ? strings.statusFilter.active : strings.statusFilter.draft}
                </span>
              </div>
              <span className="plan-dialog-price">
                {plan.currency || "INR"} {Number(plan.price).toLocaleString("en-IN")}
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

            <div className="plan-metric-card metric-tests">
              <div className="plan-metric-icon">
                <Icon name="session" />
              </div>
              <div className="plan-metric-info">
                <span className="plan-metric-label">{t.testLimit}</span>
                <strong className="plan-metric-val">
                  {plan.test_limit.toLocaleString()} {t.testsSuffix}
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
              <span style={{ color: "#64748b" }}>{t.targetAudience} </span>
              <strong style={{ textTransform: "capitalize", color: "#0f172a" }}>{plan.audience.replace("_", " ")}</strong>
            </div>
            <div>
              <span style={{ color: "#64748b" }}>{t.publishStatus} </span>
              <strong style={{ color: "#0f172a" }}>{plan.is_published ? t.published : t.draft}</strong>
            </div>
          </div>
        </div>

        <div className="plan-dialog-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            {t.close}
          </button>
          <Link to={`/super-admin/plans/${plan.id}`} className="button-link" onClick={onClose}>
            {t.editPlan}
          </Link>
        </div>
      </div>
    </div>,
    document.body
  );
}
