import { BarChart } from "@/components/charts/BarChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { dashboardStrings as strings } from "../Dashboard.strings";
import { PAYMENT_STATUS_COLORS, SUBSCRIPTION_STATE_COLORS, formatMoney } from "../helpers";
import type { Summary } from "../types";

interface DashboardChartsProps {
  summary: Summary;
}

export function DashboardCharts({ summary }: DashboardChartsProps) {
  const t = strings.charts;
  const stateLabels = strings.subscriptionStateLabels;

  const institutesByRevenue = summary.revenue_by_institute.map((r) => ({
    label: r.institute_name,
    value: Number(r.total),
  }));

  const revenueByMonth = summary.revenue_by_month.map((r) => ({
    label: r.month,
    value: Number(r.total),
  }));

  const paymentStatusData = summary.payment_status_breakdown.map((p) => ({
    label: p.status.charAt(0).toUpperCase() + p.status.slice(1),
    value: p.count,
    color: PAYMENT_STATUS_COLORS[p.status] ?? "var(--series-1)",
  }));

  const instituteStateData = summary.institute_status_breakdown.map((s) => ({
    label: stateLabels[s.state as keyof typeof stateLabels] ?? s.state,
    value: s.count,
    color: SUBSCRIPTION_STATE_COLORS[s.state] ?? "var(--series-1)",
  }));
  const instituteStateLegend = instituteStateData.map((d) => ({ label: d.label, color: d.color }));

  return (
    <div className="dashboard-charts-grid">
      <BarChart data={institutesByRevenue} orientation="horizontal" formatValue={formatMoney} ariaLabel={t.byInstituteAriaLabel} emptyMessage={t.revenueEmpty} />

      <BarChart data={revenueByMonth} orientation="vertical" formatValue={formatMoney} ariaLabel={t.byMonthAriaLabel} emptyMessage={t.revenueEmpty} />

      <DonutChart data={paymentStatusData} centerLabel={t.paymentStatusCenterLabel} ariaLabel={t.paymentStatusAriaLabel} emptyMessage={t.paymentStatusEmpty} />

      <BarChart data={instituteStateData} orientation="vertical" legend={instituteStateLegend} ariaLabel={t.instituteStateAriaLabel} emptyMessage={t.instituteStateEmpty} />
    </div>
  );
}
