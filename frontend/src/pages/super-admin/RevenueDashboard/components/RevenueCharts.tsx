import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { revenueDashboardStrings as strings } from "../RevenueDashboard.strings";
import { formatCurrency } from "../helpers";
import type { Summary } from "../types";

interface RevenueChartsProps {
  summary: Summary;
}

export function RevenueCharts({ summary }: RevenueChartsProps) {
  const t = strings.charts;
  return (
    <div className="revenue-tables-grid">
      <LineChart
        data={summary.by_institute.map((row) => ({
          label: row.institute_name,
          value: Number(row.total) || 0,
          subtext: `${row.count} ${t.txnsSuffix}`,
        }))}
        title={t.byInstituteAriaLabel}
        formatValue={(val) => formatCurrency(String(val))}
        ariaLabel={t.byInstituteAriaLabel}
        emptyMessage={t.byInstituteEmpty}
      />

      <BarChart
        data={summary.by_month.map((row) => ({
          label: row.month,
          value: Number(row.total) || 0,
          subtext: `${row.count} ${t.txnsSuffix}`,
        }))}
        title={t.byMonthAriaLabel}
        orientation="vertical"
        formatValue={(val) => formatCurrency(String(val))}
        ariaLabel={t.byMonthAriaLabel}
        emptyMessage={t.byMonthEmpty}
      />
    </div>
  );
}
