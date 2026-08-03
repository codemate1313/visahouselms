const DATE_FORMAT: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" };
const DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = { ...DATE_FORMAT, hour: "2-digit", minute: "2-digit" };

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Platform-standard date rendering, e.g. "03 Aug 2026". */
export function formatDate(value: string | number | Date | null | undefined, fallback = "—"): string {
  const d = toDate(value);
  return d ? d.toLocaleDateString("en-GB", DATE_FORMAT) : fallback;
}

/** Platform-standard date+time rendering, e.g. "03 Aug 2026, 14:05". */
export function formatDateTime(value: string | number | Date | null | undefined, fallback = "—"): string {
  const d = toDate(value);
  return d ? d.toLocaleString("en-GB", DATE_TIME_FORMAT) : fallback;
}
