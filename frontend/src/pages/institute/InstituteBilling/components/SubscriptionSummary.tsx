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
  const terms = subscription.terms ?? [];
  const timeline = subscription.seat_timeline ?? [];
  const lastEnd = terms.length ? terms[terms.length - 1].expires_at : null;
  // The first point at which capacity drops. Only worth surfacing if it
  // actually falls - a timeline that only ever holds steady is noise.
  const stepDownIndex = timeline.findIndex(
    (step, index) => index > 0 && step.seats < timeline[index - 1].seats,
  );
  const stepDown =
    stepDownIndex > 0
      ? { from: timeline[stepDownIndex - 1], to: timeline[stepDownIndex] }
      : null;
  return (
    <>
      <div className="subscription-summary-banner">
        <div className="subscription-summary-copy">
          <span>{strings.planLabel}</span>
          <strong>{subscription.subscription?.plan_name ?? strings.noActivePlan}</strong>
        </div>
        <div className="subscription-summary-state">
          <Badge tone={STATE_CLASS[subscription.state] ?? "gray"}>{subscription.state}</Badge>
          {subscription.subscription && (
            <span>{strings.validUntil(formatDate(subscription.subscription.expires_at))}</span>
          )}
        </div>
      </div>

      {/* More than one term running means a plan was bought while another was
          still live. Naming only one of them is what made a stacked purchase
          look like it had vanished, so every paid term is listed. */}
      {terms.length > 1 && (
        <section className="term-stack" aria-label={strings.terms.ariaLabel}>
          <p className="term-stack-heading">{strings.terms.heading(terms.length)}</p>
          <ol className="term-stack-list">
            {terms.map((term, index) => (
              <li key={`${term.plan_name}-${term.starts_at}-${index}`}>
                <strong>{term.plan_name}</strong>
                <span className="muted-text">
                  {strings.terms.range(formatDate(term.starts_at), formatDate(term.expires_at))}
                </span>
                <Badge tone={STATE_CLASS[term.state] ?? "gray"}>{term.state}</Badge>
              </li>
            ))}
          </ol>
          <p className="muted-text">{strings.terms.combined(formatDate(lastEnd))}</p>
        </section>
      )}

      {stepDown && (
        <p className="term-stack-warning">
          {strings.terms.stepDown(
            stepDown.from.seats,
            stepDown.to.seats,
            formatDate(stepDown.to.from),
          )}
        </p>
      )}

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
