import { revenueDashboardStrings as strings } from "../RevenueDashboard.strings";
import { formatCurrency } from "../helpers";
import type { Summary } from "../types";

interface RevenueKpiRowProps {
  summary: Summary;
}

export function RevenueKpiRow({ summary }: RevenueKpiRowProps) {
  const t = strings.kpi;
  return (
    <div className="stat-tile-row revenue-kpi-row">
      <div className="stat-tile revenue-kpi-tile">
        <p className="stat-label">{t.totalRevenue}</p>
        <p className="stat-value">{formatCurrency(summary.total_revenue)}</p>
      </div>
      <div className="stat-tile revenue-kpi-tile">
        <p className="stat-label">{t.b2b}</p>
        <p className="stat-value">{formatCurrency(summary.b2b_revenue)}</p>
      </div>
      <div className="stat-tile revenue-kpi-tile">
        <p className="stat-label">{t.b2c}</p>
        <p className="stat-value">{formatCurrency(summary.b2c_revenue)}</p>
      </div>
      <div className="stat-tile revenue-kpi-tile">
        <p className="stat-label">{t.totalDue}</p>
        <p className="stat-value due-text">{formatCurrency(summary.total_due)}</p>
      </div>
      <div className="stat-tile revenue-kpi-tile">
        <p className="stat-label">{t.transactions}</p>
        <p className="stat-value">{summary.transaction_count}</p>
      </div>
    </div>
  );
}
