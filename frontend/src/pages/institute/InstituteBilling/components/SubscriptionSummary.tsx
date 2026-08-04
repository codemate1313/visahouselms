import { MetricCard } from "@/components/dashboard/MetricCard";
import { instituteBillingStrings as strings } from "../InstituteBilling.strings";
import { STATE_CLASS, type SubscriptionStatus } from "../types";
import { formatDate } from "@/utils/date";
import { Badge } from "@/components/ui";

interface SubscriptionSummaryProps {
  subscription: SubscriptionStatus;
}

export function SubscriptionSummary({ subscription }: SubscriptionSummaryProps) {
  const t = strings.stats;
  return (
    <>
      <div className="banner">
        <strong>{subscription.subscription?.plan_name ?? strings.noActivePlan}</strong>{" "}
        <Badge tone={STATE_CLASS[subscription.state] ?? "gray"}>{subscription.state}</Badge>
        {subscription.subscription && ` ${strings.validUntil(formatDate(subscription.subscription.expires_at))}`}
      </div>

      {subscription.limits && (
        <div className="metric-grid">
          <MetricCard label={t.students} value={`${subscription.usage.students} / ${subscription.limits.students}`} tone="blue" icon="user" />
          <MetricCard label={t.instructors} value={`${subscription.usage.staff} / ${subscription.limits.staff}`} tone="green" icon="instructors" />
          {/* Seats are capped, sittings are not - so this reports how many
              tests have been taken rather than how many are left. */}
          <MetricCard label={t.testsTaken} value={subscription.usage.tests} caption={t.testsUnmetered} tone="purple" icon="grading" />
        </div>
      )}
    </>
  );
}
