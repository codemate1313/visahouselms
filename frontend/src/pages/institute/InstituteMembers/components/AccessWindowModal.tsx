import { type FormEvent, useState } from "react";
import { Badge, Modal } from "@/components/ui";
import { instituteMembersStrings as strings } from "../InstituteMembers.strings";
import type { InstituteMember } from "../types";

export type WindowModalMode = "extend" | "reactivate";

interface AccessWindowModalProps {
  mode: WindowModalMode;
  member: InstituteMember;
  /** Nothing may be granted past this; the date inputs enforce it. */
  subscriptionEndsOn: string | null;
  /** Reactivating takes a seat, so the caller tells us whether one is free. */
  seatsFree: number | null;
  busy: boolean;
  error: string | null;
  onSubmit: (startsOn: string, endsOn: string) => void;
  onClose: () => void;
}

/**
 * Picks the dates for a new or changed access window.
 *
 * Two jobs behind one form, because the fields are identical and the only
 * difference is what it costs: extending a seated student is free, reactivating
 * a past student takes a seat and can be refused. The copy says which, so
 * nobody clicks Reactivate at a full institute and reads the 402 as a bug.
 */
export function AccessWindowModal({
  mode,
  member,
  subscriptionEndsOn,
  seatsFree,
  busy,
  error,
  onSubmit,
  onClose,
}: AccessWindowModalProps) {
  const t = strings.windowModal;
  const today = todayIso();
  const [startsOn, setStartsOn] = useState(
    mode === "extend" ? member.access_starts_on ?? today : today,
  );
  const [endsOn, setEndsOn] = useState(
    mode === "extend" && member.access_ends_on && member.access_ends_on > today
      ? member.access_ends_on
      : "",
  );

  const noSeat = mode === "reactivate" && seatsFree !== null && seatsFree <= 0;
  const orderWrong = Boolean(startsOn && endsOn && endsOn < startsOn);
  const pastSubscription = Boolean(subscriptionEndsOn && endsOn && endsOn > subscriptionEndsOn);
  const canSubmit =
    Boolean(startsOn && endsOn) && !orderWrong && !pastSubscription && !noSeat && !busy;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit(startsOn, endsOn);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t.title(mode)}
      size="sm"
      className="access-window-modal"
      actions={
        <>
          <button type="submit" form="access-window-form" className="btn-primary" disabled={!canSubmit}>
            {busy ? t.saving : t.confirm(mode)}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            {t.cancel}
          </button>
        </>
      }
    >
      <p className="muted-text">
        {t.forStudent(`${member.first_name} ${member.last_name}`, member.email)}
      </p>

      {mode === "reactivate" && (
        <p className={noSeat ? "error-text" : "muted-text"}>
          {noSeat ? t.noSeatWarning : t.takesASeat(seatsFree)}
        </p>
      )}

      <form id="access-window-form" onSubmit={submit}>
        <div className="form-grid">
          <div>
            <label htmlFor="access_starts_on">{t.startsOn}</label>
            <input
              id="access_starts_on"
              type="date"
              value={startsOn}
              max={subscriptionEndsOn ?? undefined}
              onChange={(event) => setStartsOn(event.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="access_ends_on">{t.endsOn}</label>
            <input
              id="access_ends_on"
              type="date"
              value={endsOn}
              min={startsOn || today}
              max={subscriptionEndsOn ?? undefined}
              onChange={(event) => setEndsOn(event.target.value)}
              required
            />
          </div>
        </div>

        <div className="window-quick-picks">
          <span className="muted-text">{t.quickPick}</span>
          {[1, 3, 6, 12].map((months) => (
            <button
              key={months}
              type="button"
              className="chip-button"
              onClick={() =>
                setEndsOn(clampIso(addMonths(startsOn || today, months), subscriptionEndsOn))
              }
            >
              {t.months(months)}
            </button>
          ))}
        </div>

        {subscriptionEndsOn && (
          <p className="muted-text">{t.ceiling(formatDay(subscriptionEndsOn))}</p>
        )}
        {startsOn && endsOn && !orderWrong && (
          <p>
            <Badge tone="green">{t.length(dayCount(startsOn, endsOn))}</Badge>
          </p>
        )}
        {orderWrong && <p className="error-text">{t.orderWrong}</p>}
        {pastSubscription && <p className="error-text">{t.pastSubscription}</p>}
        {error && <p className="error-text">{error}</p>}
      </form>
    </Modal>
  );
}

// -- date helpers, all on plain YYYY-MM-DD strings -------------------------
//
// Never `new Date(iso)` on a bare date string: that parses as midnight UTC and
// renders a day early anywhere west of Greenwich - the exact off-by-one this
// whole feature exists to avoid. Everything below stays in local calendar terms.

function todayIso(): string {
  const now = new Date();
  return isoOf(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function isoOf(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addMonths(iso: string, months: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const shifted = new Date(year, month - 1 + months, day);
  // Rolls "31 Jan + 1 month" back to the end of February instead of into March.
  if (shifted.getDate() !== day) shifted.setDate(0);
  return isoOf(shifted.getFullYear(), shifted.getMonth() + 1, shifted.getDate());
}

function clampIso(iso: string, ceiling: string | null): string {
  return ceiling && iso > ceiling ? ceiling : iso;
}

function dayCount(startsOn: string, endsOn: string): number {
  const [sy, sm, sd] = startsOn.split("-").map(Number);
  const [ey, em, ed] = endsOn.split("-").map(Number);
  const ms = new Date(ey, em - 1, ed).getTime() - new Date(sy, sm - 1, sd).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

function formatDay(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
