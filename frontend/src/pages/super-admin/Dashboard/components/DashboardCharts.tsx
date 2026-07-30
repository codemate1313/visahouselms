import { useState } from "react";
import { BarChart } from "@/components/charts/BarChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { LineChart } from "@/components/charts/LineChart";
import { dashboardStrings as strings } from "../Dashboard.strings";
import { PAYMENT_STATUS_COLORS, STUDENT_TYPE_COLORS, SUBSCRIPTION_STATE_COLORS, formatMoney } from "../helpers";
import type { Summary } from "../types";
import { ChartDetailModal, type ChartKey } from "./ChartDetailModal";

interface DashboardChartsProps {
  summary: Summary;
}

export function DashboardCharts({ summary }: DashboardChartsProps) {
  const [selectedChart, setSelectedChart] = useState<ChartKey | null>(null);
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

  const studentTypeData = (summary.student_type_breakdown ?? []).map((s) => ({
    label: s.label,
    value: s.count,
    color: STUDENT_TYPE_COLORS[s.type] ?? "var(--series-1)",
  }));

  return (
    <>
      <div className="dashboard-charts-grid">
        <div
          className="clickable-chart-card-wrapper"
          onClick={() => setSelectedChart("byInstitute")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && setSelectedChart("byInstitute")}
          title="Click to view detailed institute revenue analysis"
        >
          <BarChart data={institutesByRevenue} title={t.byInstituteTitle} orientation="vertical" formatValue={formatMoney} ariaLabel={t.byInstituteAriaLabel} emptyMessage={t.revenueEmpty} />
        </div>

        <div
          className="clickable-chart-card-wrapper"
          onClick={() => setSelectedChart("byMonth")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && setSelectedChart("byMonth")}
          title="Click to view detailed monthly revenue analysis"
        >
          <LineChart data={revenueByMonth} title={t.byMonthTitle} formatValue={formatMoney} ariaLabel={t.byMonthAriaLabel} emptyMessage={t.revenueEmpty} />
        </div>

        <div
          className="clickable-chart-card-wrapper"
          onClick={() => setSelectedChart("paymentStatus")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && setSelectedChart("paymentStatus")}
          title="Click to view detailed payment status analysis"
        >
          <DonutChart data={paymentStatusData} title={t.paymentStatusTitle} centerLabel={t.paymentStatusCenterLabel} ariaLabel={t.paymentStatusAriaLabel} emptyMessage={t.paymentStatusEmpty} />
        </div>

        <div
          className="clickable-chart-card-wrapper"
          onClick={() => setSelectedChart("studentType")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && setSelectedChart("studentType")}
          title="Click to view detailed student type analysis"
        >
          <DonutChart data={studentTypeData} title={t.studentTypeTitle} centerLabel={t.studentTypeCenterLabel} ariaLabel={t.studentTypeAriaLabel} emptyMessage={t.studentTypeEmpty} />
        </div>

        <div
          className="clickable-chart-card-wrapper"
          onClick={() => setSelectedChart("instituteState")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && setSelectedChart("instituteState")}
          title="Click to view detailed subscription state analysis"
        >
          <BarChart data={instituteStateData} title={t.instituteStateTitle} orientation="vertical" legend={instituteStateLegend} ariaLabel={t.instituteStateAriaLabel} emptyMessage={t.instituteStateEmpty} />
        </div>
      </div>

      {selectedChart && (
        <ChartDetailModal
          chartKey={selectedChart}
          summary={summary}
          onClose={() => setSelectedChart(null)}
        />
      )}
    </>
  );
}
