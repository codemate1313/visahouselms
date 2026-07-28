import { allocationSummaryLine, type InstituteAllocation } from "@/pages/super-admin/InstituteForm/types";
import { subscriptionsStrings as strings } from "../Subscriptions.strings";
import { STATE_BADGES, stateLabel } from "../helpers";
import type { InstituteRow, StatusResponse } from "../types";
import { QuotaPieChart } from "./QuotaPieChart";
import { ValidityGauge } from "./ValidityGauge";
import { Button } from "@/components/ui";

interface SubscriptionManageCardProps {
  status: StatusResponse;
  selectedInstitute: InstituteRow;
  /** The institute's provisions, or null if nothing is allocated yet. */
  allocation: InstituteAllocation | null;
  busy: boolean;
  onAssign: () => void;
  onRenew: () => void;
  onCancel: (subscriptionId: number) => void;
}

export function SubscriptionManageCard({
  status,
  selectedInstitute,
  allocation,
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
            {/* Provisions come from the institute's own agreement - there is
                nothing to switch between here. */}
            <div style={{ width: "100%", marginBottom: 12 }}>
              <p className="hint" style={{ margin: 0 }}>
                {allocation ? allocationSummaryLine(allocation) : t.noAllocation}
              </p>
            </div>

            {state === "none" ? (
              <Button fullWidth disabled={busy || !allocation} onClick={onAssign}>
                {busy ? t.assigning : t.assignPlan}
              </Button>
            ) : (
              <div className="actions-button-group" style={{ width: "100%" }}>
                <Button disabled={busy} onClick={onRenew} style={{ flex: 1 }}>
                  {busy ? t.renewing : t.renew}
                </Button>
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
