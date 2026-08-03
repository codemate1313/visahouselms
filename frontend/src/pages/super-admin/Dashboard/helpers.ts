import type { DetailValueType } from "./types";
import { formatDate } from "@/utils/date";

export const SUBSCRIPTION_STATE_COLORS: Record<string, string> = {
  active: "#10b981",
  grace: "#f59e0b",
  expired: "#e11d2e",
  none: "#94a3b8",
};

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  paid: "#10b981",
  partial: "#f59e0b",
  pending: "#3b82f6",
  failed: "#e11d2e",
  refunded: "#8b5cf6",
};

export const STUDENT_TYPE_COLORS: Record<string, string> = {
  direct: "#3b82f6",
  institute: "#10b981",
};

export function formatMoney(value: number): string {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function formatDetailValue(
  value: string | number | null,
  valueType: DetailValueType,
  currency?: string | null,
): string {
  if (value === null || value === "") return "—";
  if (valueType === "money") {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 0,
    }).format(Number(value));
  }
  if (valueType === "date") {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime())
      ? String(value)
      : formatDate(date);
  }
  return String(value);
}
