import { MetricCard } from "@/components/dashboard/MetricCard";
import { revenueDashboardStrings as strings } from "../RevenueDashboard.strings";
import { formatCurrency } from "../helpers";
import type { Summary } from "../types";

interface RevenueKpiRowProps {
  summary: Summary;
}

export function RevenueKpiRow({ summary }: RevenueKpiRowProps) {
  const t = strings.kpi;
  return (
    <div className="metric-grid revenue-kpi-row">
      <MetricCard label={t.totalRevenue} value={formatCurrency(summary.total_revenue)} className="revenue-kpi-tile" tone="green" icon="revenue" />
      <MetricCard label={t.b2b} value={formatCurrency(summary.b2b_revenue)} className="revenue-kpi-tile" tone="blue" icon="building" />
      <MetricCard label={t.b2c} value={formatCurrency(summary.b2c_revenue)} className="revenue-kpi-tile" tone="purple" icon="user" />
      <MetricCard label={t.totalDue} value={formatCurrency(summary.total_due)} className="revenue-kpi-tile" valueClassName="due-text" tone="amber" icon="due" />
      <MetricCard label={t.transactions} value={summary.transaction_count} className="revenue-kpi-tile" tone="slate" icon="transactions" />
    </div>
  );
}
