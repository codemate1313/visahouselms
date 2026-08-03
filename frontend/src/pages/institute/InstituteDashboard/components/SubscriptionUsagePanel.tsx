import { Link } from "react-router-dom";
import { instituteDashboardStrings as strings } from "../InstituteDashboard.strings";
import { STATE_CLASS, type DashboardSummary } from "../types";
import { formatDate } from "@/utils/date";
import { Badge } from "@/components/ui";

interface SubscriptionUsagePanelProps {
  subscriptionSummary: NonNullable<DashboardSummary["subscription"]>;
}

export function SubscriptionUsagePanel({ subscriptionSummary }: SubscriptionUsagePanelProps) {
  const t = strings.subscriptionPanel;
  const subscription = subscriptionSummary.subscription;
  const limits = subscriptionSummary.limits;

  return (
    <section className="workspace-panel">
      <div className="panel-heading">
        <div>
          <h2>{t.heading}</h2>
          <p>{subscription?.plan_name ?? t.noActivePlan}</p>
        </div>
        <Badge tone={STATE_CLASS[subscriptionSummary.state] ?? "gray"}>
          {subscriptionSummary.state}
        </Badge>
      </div>
      {limits ? (
        <div className="usage-list">
          {(["students", "staff"] as const).map((resource) => {
            const used = subscriptionSummary.usage[resource];
            const limit = limits[resource];
            const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 100;
            return (
              <div className="usage-row" key={resource}>
                <div>
                  <span>{resource === "staff" ? t.instructorsLabel : resource}</span>
                  <strong>{used} / {limit}</strong>
                </div>
                <div className="usage-track"><span style={{ width: `${percent}%` }} /></div>
              </div>
            );
          })}
          {subscription && <p className="hint">{t.renewsOrExpires(formatDate(subscription.expires_at))}</p>}
        </div>
      ) : (
        <p className="empty-message">{t.noneAssigned}</p>
      )}
      <Link to="/institute-portal/billing">{t.viewSubscription}</Link>
    </section>
  );
}
