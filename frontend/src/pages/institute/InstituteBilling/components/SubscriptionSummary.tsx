import { instituteBillingStrings as strings } from "../InstituteBilling.strings";
import { STATE_CLASS, type SubscriptionStatus } from "../types";

interface SubscriptionSummaryProps {
  subscription: SubscriptionStatus;
}

export function SubscriptionSummary({ subscription }: SubscriptionSummaryProps) {
  const t = strings.stats;
  return (
    <>
      <div className="banner">
        <strong>{subscription.subscription?.plan_name ?? strings.noActivePlan}</strong>{" "}
        <span className={`badge ${STATE_CLASS[subscription.state] ?? "badge-gray"}`}>{subscription.state}</span>
        {subscription.subscription && ` ${strings.validUntil(new Date(subscription.subscription.expires_at).toLocaleDateString())}`}
      </div>

      {subscription.limits && (
        <div className="stat-tile-row">
          <div className="stat-tile">
            <p className="stat-label">{t.students}</p>
            <p className="stat-value">{subscription.usage.students} / {subscription.limits.students}</p>
          </div>
          <div className="stat-tile">
            <p className="stat-label">{t.instructors}</p>
            <p className="stat-value">{subscription.usage.staff} / {subscription.limits.staff}</p>
          </div>
          <div className="stat-tile">
            <p className="stat-label">{t.tests}</p>
            <p className="stat-value">
              {subscription.limits.tests === null ? t.unlimited : `${subscription.usage.tests} / ${subscription.limits.tests}`}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
