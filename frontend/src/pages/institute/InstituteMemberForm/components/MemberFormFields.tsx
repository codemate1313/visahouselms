import type { ChangeEvent, FormEvent } from "react";
import { Badge, RequiredMark } from "@/components/ui";
import { Button } from "@/components/ui/Button/Button";
import { instituteMemberFormStrings as strings } from "../InstituteMemberForm.strings";

export type MemberFormField =
  | "email"
  | "first_name"
  | "last_name"
  | "phone_number"
  | "address"
  | "access_starts_on"
  | "access_ends_on";

interface MemberFormFieldsProps {
  isNew: boolean;
  label: string;
  form: {
    email: string;
    first_name: string;
    last_name: string;
    phone_number: string;
    address: string;
    // Absent for direct (B2C) students, who buy their own access and hold no
    // institute seat - so this same form serves both without a second copy.
    access_starts_on?: string;
    access_ends_on?: string;
  };
  /** Only institute students hold seats, so only they get a window. */
  showAccessWindow?: boolean;
  /** Nothing may be granted past this. Also caps the date inputs. */
  subscriptionEndsOn?: string | null;
  saving: boolean;
  error: string | null;
  onFieldChange: (field: MemberFormField) => (event: ChangeEvent<HTMLInputElement>) => void;
  onSetEndDate?: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
}

export function MemberFormFields({
  isNew,
  label,
  form,
  showAccessWindow = false,
  subscriptionEndsOn = null,
  saving,
  error,
  onFieldChange,
  onSetEndDate,
  onSubmit,
  onCancel,
}: MemberFormFieldsProps) {
  const f = strings.fields;
  const startsOn = form.access_starts_on ?? "";
  const endsOn = form.access_ends_on ?? "";
  const orderWrong = Boolean(startsOn && endsOn && endsOn < startsOn);
  const pastSubscription = Boolean(subscriptionEndsOn && endsOn && endsOn > subscriptionEndsOn);
  const blocked = showAccessWindow && (orderWrong || pastSubscription);
  return (
    <div>
      <h1>{isNew ? strings.addTitle(label) : strings.editTitle(label)}</h1>
      <form className="form-card wide" onSubmit={onSubmit}>
        <div className="form-grid">
          <div><label htmlFor="first_name">{f.firstName}<RequiredMark /></label><input id="first_name" value={form.first_name} onChange={onFieldChange("first_name")} required /></div>
          <div><label htmlFor="last_name">{f.lastName}<RequiredMark /></label><input id="last_name" value={form.last_name} onChange={onFieldChange("last_name")} required /></div>
        </div>
        <label htmlFor="email">{f.email}<RequiredMark /></label><input id="email" type="email" value={form.email} onChange={onFieldChange("email")} required />
        <label htmlFor="phone_number">{f.phoneNumber}<RequiredMark /></label><input id="phone_number" value={form.phone_number} onChange={onFieldChange("phone_number")} required />
        <label htmlFor="address">{f.address}</label><input id="address" value={form.address} onChange={onFieldChange("address")} />

        {showAccessWindow && (
          <fieldset className="access-window-fieldset">
            <legend>{f.accessHint}</legend>
            <div className="form-grid">
              <div>
                <label htmlFor="access_starts_on">{f.accessStartsOn}<RequiredMark /></label>
                <input
                  id="access_starts_on"
                  type="date"
                  value={startsOn}
                  max={subscriptionEndsOn ?? undefined}
                  onChange={onFieldChange("access_starts_on")}
                  required
                />
              </div>
              <div>
                <label htmlFor="access_ends_on">{f.accessEndsOn}<RequiredMark /></label>
                <input
                  id="access_ends_on"
                  type="date"
                  value={endsOn}
                  min={startsOn || undefined}
                  max={subscriptionEndsOn ?? undefined}
                  onChange={onFieldChange("access_ends_on")}
                  required
                />
              </div>
            </div>
            <div className="window-quick-picks">
              <span className="muted-text">{f.quickPick}</span>
              {[1, 3, 6, 12].map((months) => (
                <Button
                  key={months}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="chip-button"
                  onClick={() => onSetEndDate?.(clampIso(addMonths(startsOn || todayIso(), months), subscriptionEndsOn))}
                >
                  {f.months(months)}
                </Button>
              ))}
            </div>
            {subscriptionEndsOn && <p className="muted-text">{f.accessCeiling(formatDay(subscriptionEndsOn))}</p>}
            {startsOn && endsOn && !orderWrong && (
              <p><Badge tone="green">{f.accessLength(dayCount(startsOn, endsOn))}</Badge></p>
            )}
            {orderWrong && <p className="error-text">{f.accessOrderWrong}</p>}
            {pastSubscription && <p className="error-text">{f.accessPastSubscription}</p>}
          </fieldset>
        )}

        {error && <p className="error-text">{error}</p>}
        <div className="form-actions">
          <Button type="submit" disabled={saving || blocked}>{saving ? strings.actions.saving : strings.actions.save(label)}</Button>
          <Button type="button" variant="secondary" onClick={onCancel}>{strings.actions.cancel}</Button>
        </div>
      </form>
    </div>
  );
}

// -- calendar-date helpers -------------------------------------------------
//
// All on YYYY-MM-DD strings. `new Date("2027-03-31")` parses as midnight UTC
// and renders a day early west of Greenwich, which is precisely the off-by-one
// this feature exists to prevent.

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
