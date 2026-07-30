import { MetricCard } from "@/components/dashboard/MetricCard";
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
        <div className="metric-grid">
          <MetricCard label={t.students} value={`${subscription.usage.students} / ${subscription.limits.students}`} tone="blue" icon="user" />
          <MetricCard label={t.instructors} value={`${subscription.usage.staff} / ${subscription.limits.staff}`} tone="green" icon="instructors" />
          <MetricCard label={t.tests} value={subscription.limits.tests === null ? t.unlimited : `${subscription.usage.tests} / ${subscription.limits.tests}`} tone="purple" icon="grading" />
        </div>
      )}
    </>
  );
}
