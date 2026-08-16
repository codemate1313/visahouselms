import { Badge } from "@/components/ui";
import { instituteMembersStrings as strings } from "../InstituteMembers.strings";
import type { MemberCapacity } from "../types";

interface SeatPanelProps {
  capacity: MemberCapacity;
  /** Jumps the roster to the students whose seats can be reclaimed. */
  onShowReclaimable: () => void;
  onShowPastStudents: () => void;
}

/**
 * What the institute is actually paying for, above the roster.
 *
 * The capacity endpoint has always existed; the page used it only to grey out
 * the Add student button, so an admin at 99 of 100 seats got no warning until
 * the 101st attempt failed. Worse, when they hit the wall the old advice was to
 * delete a student - which releases their email and makes them unreturnable.
 *
 * This panel shows the number before it bites, and points at the students whose
 * seats can be freed without destroying anything.
 */
export function SeatPanel({ capacity, onShowReclaimable, onShowPastStudents }: SeatPanelProps) {
  const t = strings.seats;
  const { seats } = capacity;
  if (seats.total === null) return null;

  const used = seats.used;
  const total = seats.total;
  const free = seats.free ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const tone = free === 0 ? "red" : free <= Math.max(1, Math.round(total * 0.1)) ? "amber" : "green";

  return (
    <section className="seat-panel" aria-label={t.ariaLabel}>
      <div className="seat-panel-head">
        <div>
          <span className="seat-panel-eyebrow">{t.eyebrow}</span>
          <p className="seat-panel-count">
            <strong>{used}</strong>
            <span className="muted-text"> / {total}</span>
            <Badge tone={tone}>{t.free(free)}</Badge>
          </p>
        </div>
        {capacity.subscription_ends_on && (
          <p className="muted-text seat-panel-subscription">
            {t.subscriptionEnds(formatDay(capacity.subscription_ends_on))}
          </p>
        )}
      </div>

      <div
        className="seat-panel-bar"
        role="img"
        aria-label={t.barLabel(used, total)}
      >
        <span className="seat-panel-bar-fill" style={{ width: `${pct}%` }} data-tone={tone} />
      </div>

      <div className="seat-panel-breakdown">
        <span>{t.activeCount(seats.active)}</span>
        {seats.suspended > 0 && <span>{t.suspendedCount(seats.suspended)}</span>}
        {seats.expired > 0 && <span>{t.expiredCount(seats.expired)}</span>}
      </div>

      <div className="seat-panel-actions">
        {seats.reclaimable > 0 && (
          <button type="button" className="link-button" onClick={onShowReclaimable}>
            {t.reclaimableLink(seats.reclaimable)}
          </button>
        )}
        {seats.past_students > 0 && (
          <button type="button" className="link-button" onClick={onShowPastStudents}>
            {t.pastStudentsLink(seats.past_students)}
          </button>
        )}
      </div>
    </section>
  );
}

function formatDay(iso: string): string {
  // Deliberately parsed as a plain calendar date. `new Date("2027-03-31")` is
  // midnight UTC, which renders as 30 March for anyone west of Greenwich - the
  // exact off-by-one-day bug this whole feature exists to avoid.
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
