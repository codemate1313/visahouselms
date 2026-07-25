import { SearchableSelect } from "@/components/ui";
import type { PlanRow } from "@/pages/super-admin/Plans";
import { subscriptionsStrings as strings } from "../Subscriptions.strings";
import { STATE_BADGES, stateLabel } from "../helpers";
import type { InstituteRow, StatusResponse } from "../types";
import { QuotaPieChart } from "./QuotaPieChart";
import { ValidityGauge } from "./ValidityGauge";

interface SubscriptionManageCardProps {
  status: StatusResponse;
  selectedInstitute: InstituteRow;
  plans: PlanRow[];
  planChoice: string;
  onPlanChoiceChange: (value: string) => void;
  busy: boolean;
  onAssign: () => void;
  onRenew: () => void;
  onCancel: (subscriptionId: number) => void;
}

export function SubscriptionManageCard({
  status,
  selectedInstitute,
  plans,
  planChoice,
  onPlanChoiceChange,
  busy,
  onAssign,
  onRenew,
  onCancel,
}: SubscriptionManageCardProps) {
  const t = strings;
  const current = status.subscription;
  const state = status.state;

  return (
    <div className="form-card wide subscription-manage-card-v2">
      <div className="subscription-card-grid">
        <div className="sub-card-col-left">
          <div className="subscription-head-v2">
            <span className="table-item-subtitle" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--slate-500)" }}>
              {selectedInstitute.name}
            </span>
            <h2 className="subscription-plan-title">{current?.plan_name ?? t.noActivePlan}</h2>
            <span className={`badge ${STATE_BADGES[state]}`}>{stateLabel(state)}</span>
          </div>

          {current && state !== "none" && (
            <div className="subscription-dates-box">
              <p>
                <span>{t.starts}</span> <strong>{new Date(current.starts_at).toLocaleDateString("en-GB")}</strong>
              </p>
              <p>
                <span>{t.expires}</span> <strong>{new Date(current.expires_at).toLocaleDateString("en-GB")}</strong>
              </p>
              {current.days_remaining != null && (
                <p>
                  <span>{state === "grace" ? t.graceDaysLeft : t.daysLeft}</span>{" "}
                  <strong className="highlight-days">{current.days_remaining}</strong>
                </p>
              )}
            </div>
          )}

          <div className="subscription-actions-bar-v2">
            <div style={{ width: "100%", marginBottom: 12 }}>
              <SearchableSelect
                options={[
                  { value: "", label: state === "none" ? t.selectPlan : t.samePlan },
                  ...plans
                    .filter((p) => p.is_active)
                    .map((plan) => ({
                      value: String(plan.id),
                      label: `${plan.name} (${plan.currency || "INR"} ${plan.price} / ${plan.duration_days}d)`,
                    })),
                ]}
                value={planChoice}
                onChange={(val) => onPlanChoiceChange(String(val))}
                placeholder={state === "none" ? t.selectPlan : t.samePlan}
                searchable={false}
              />
            </div>

            {state === "none" ? (
              <button type="button" className="button-link primary-submit-btn" disabled={busy || !planChoice} onClick={onAssign} style={{ width: "100%" }}>
                {busy ? t.assigning : t.assignPlan}
              </button>
            ) : (
              <div className="actions-button-group" style={{ width: "100%" }}>
                <button type="button" className="button-link primary-submit-btn" disabled={busy} onClick={onRenew} style={{ flex: 1 }}>
                  {busy ? t.renewing : t.renew}
                </button>
                {current && !current.cancelled_at && (
                  <button type="button" className="danger-cancel-btn" disabled={busy} onClick={() => onCancel(current.id)} style={{ flex: 1 }}>
                    {t.cancelSubscription}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="sub-card-col-right">
          {status.limits && <QuotaPieChart usage={status.usage} limits={status.limits} />}
          <ValidityGauge daysRemaining={current?.days_remaining ?? null} state={state} />
        </div>
      </div>
    </div>
  );
}
