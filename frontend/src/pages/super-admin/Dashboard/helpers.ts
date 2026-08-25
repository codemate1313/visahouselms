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

export interface RevenueTrend {
  /** e.g. "+18% vs last month" - `null` when there isn't enough real history to compare. */
  badge: string | null;
  /** Monthly revenue totals in chronological order, for the metric card sparkline. */
  series: number[];
}

/**
 * Derives the revenue growth badge and sparkline series from real month-by-month
 * revenue totals, rather than a hardcoded/fabricated percentage.
 *
 * There is no daily-granularity revenue history in the API, so this compares the
 * most recent two months rather than pretending to match the dashboard's 7D/30D/90D
 * range selector - an honest "vs last month" figure beats a fake range-specific one.
 */
export function computeRevenueTrend(byMonth: { month: string; total: string; count: number }[]): RevenueTrend {
  const series = byMonth.map((entry) => Number(entry.total));
  if (series.length < 2) return { badge: null, series };

  const previous = series[series.length - 2];
  const current = series[series.length - 1];
  if (!(previous > 0)) return { badge: null, series };

  const percentChange = ((current - previous) / previous) * 100;
  const rounded = Math.round(percentChange);
  const sign = rounded > 0 ? "+" : "";
  return { badge: `${sign}${rounded}% vs last month`, series };
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
