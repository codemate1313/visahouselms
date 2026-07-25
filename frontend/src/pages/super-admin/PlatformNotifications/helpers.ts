export function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Draft";
}

export function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}
