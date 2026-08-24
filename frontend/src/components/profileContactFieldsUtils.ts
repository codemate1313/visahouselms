/** yyyy-MM-dd for a <input type="date">, from an ISO datetime string or null. */
export function toDateInputValue(iso: string | null | undefined): string {
  return iso ? iso.split("T")[0] : "";
}

/** ISO datetime (or null) to send back to the API from a date input's value. */
export function fromDateInputValue(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

