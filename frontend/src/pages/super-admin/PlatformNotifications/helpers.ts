import { formatDateTime } from "@/utils/date";

export function formatDate(value: string | null) {
  return formatDateTime(value, "Draft");
}

export function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}
