export function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Draft";
}

export function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}
