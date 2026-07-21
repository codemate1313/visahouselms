import { useEffect, useState } from "react";
import { apiClient } from "../../api/client";
import { AnimatedCounter } from "../../components/AnimatedCounter";
import { BarChart } from "../../components/charts/BarChart";
import { DonutChart } from "../../components/charts/DonutChart";

interface Summary {
  counts: {
    institutes_total: number;
    institutes_active: number;
    subscriptions_active: number;
    demo_accounts_active: number;
    coupons_active: number;
    super_admin_accounts: number;
    sa_instructor_accounts: number;
    modules_total: number;
    modules_published: number;
  };
  revenue: {
    total_revenue: string;
    b2b_revenue: string;
    b2c_revenue: string;
    total_due: string;
    transaction_count: number;
  };
  revenue_by_institute: { institute_id: number; institute_name: string; total: string; count: number }[];
  revenue_by_month: { month: string; total: string; count: number }[];
  payment_status_breakdown: { status: string; count: number }[];
  institute_status_breakdown: { state: string; count: number }[];
}

const SUBSCRIPTION_STATE_COLORS: Record<string, string> = {
  active: "#10b981",  // Emerald Green
  grace: "#f59e0b",   // Amber Gold
  expired: "#ef4444", // Coral Red
  none: "#94a3b8",    // Slate
};

const SUBSCRIPTION_STATE_LABELS: Record<string, string> = {
  active: "Active",
  grace: "In grace",
  expired: "Expired",
  none: "No plan",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  paid: "#10b981",     // Emerald Green
  partial: "#f59e0b",  // Amber Gold
  pending: "#3b82f6",  // Electric Blue
  failed: "#ef4444",   // Coral Red
  refunded: "#8b5cf6", // Violet Purple
};

function formatMoney(value: number): string {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function MetricItem({
  label,
  numericValue,
  badgeText,
  badgeTheme = "green",
  isCurrency = false,
  valueClassName = "",
}: {
  label: string;
  numericValue: number;
  badgeText?: string;
  badgeTheme?: "green" | "blue" | "amber" | "purple" | "slate";
  isCurrency?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="metric-strip-item">
      <div className="metric-strip-label">
        <span className={`metric-indicator-dot dot-${badgeTheme}`} />
        <span>{label}</span>
      </div>
      <div className="metric-strip-value-row">
        <span className={`metric-strip-number${valueClassName ? ` ${valueClassName}` : ""}`}>
          <AnimatedCounter
            value={numericValue}
            duration={1200}
            format={isCurrency ? formatMoney : undefined}
          />
        </span>
        {badgeText && <span className={`metric-trend-pill pill-${badgeTheme}`}>{badgeText}</span>}
      </div>
    </div>
  );
}

export function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<Summary>("/super-admin/dashboard/summary")
      .then(({ data }) => setSummary(data))
      .catch(() => setError("Failed to load dashboard."));
  }, []);

  if (error) return <p className="error-text">{error}</p>;
  if (!summary) return <p>Loading...</p>;

  const { counts, revenue } = summary;

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
    label: SUBSCRIPTION_STATE_LABELS[s.state] ?? s.state,
    value: s.count,
    color: SUBSCRIPTION_STATE_COLORS[s.state] ?? "var(--series-1)",
  }));
  const instituteStateLegend = instituteStateData.map((d) => ({ label: d.label, color: d.color }));

  return (
    <div className="dashboard-overview">
      <div className="page-header">
        <div>
          <span className="page-eyebrow">Platform Overview</span>
          <h1>{getGreeting()}, Super Admin</h1>
          <p className="page-subtitle">A real-time overview of institutes, subscriptions, and platform revenue.</p>
        </div>
      </div>

      {/* Completely Iconless & Cardless Executive Metric Strip */}
      <div className="executive-metric-strip">
        <MetricItem label="Total Institutes" numericValue={counts.institutes_total} badgeText="Active" badgeTheme="green" />
        <MetricItem label="Active Subscriptions" numericValue={counts.subscriptions_active} badgeText="Live" badgeTheme="blue" />
        <MetricItem label="Total Revenue" numericValue={Number(revenue.total_revenue)} isCurrency badgeText="+18% growth" badgeTheme="green" />
        <MetricItem label="Total Due" numericValue={Number(revenue.total_due)} isCurrency valueClassName="due-text" badgeText="Pending" badgeTheme="amber" />
        <MetricItem label="Transactions" numericValue={revenue.transaction_count} badgeText="Settled" badgeTheme="slate" />
        <MetricItem label="Active Demos" numericValue={counts.demo_accounts_active} badgeText="Demo" badgeTheme="blue" />
        <MetricItem label="SA Instructors" numericValue={counts.sa_instructor_accounts} badgeText="Verified" badgeTheme="green" />
        <MetricItem label="Published Modules" numericValue={counts.modules_published} badgeText="Published" badgeTheme="purple" />
      </div>

      <div className="dashboard-charts-grid">
        <div>
          <h2 className="section-title">Revenue by institute</h2>
          <BarChart
            data={institutesByRevenue}
            orientation="horizontal"
            formatValue={formatMoney}
            ariaLabel="Revenue by institute"
            emptyMessage="No revenue recorded yet."
          />
        </div>

        <div>
          <h2 className="section-title">Revenue by month</h2>
          <BarChart
            data={revenueByMonth}
            orientation="vertical"
            formatValue={formatMoney}
            ariaLabel="Revenue by month"
            emptyMessage="No revenue recorded yet."
          />
        </div>

        <div>
          <h2 className="section-title">Payment status</h2>
          <DonutChart
            data={paymentStatusData}
            centerLabel="payments"
            ariaLabel="Payment status breakdown"
            emptyMessage="No payments recorded yet."
          />
        </div>

        <div>
          <h2 className="section-title">Institutes by subscription state</h2>
          <BarChart
            data={instituteStateData}
            orientation="vertical"
            legend={instituteStateLegend}
            ariaLabel="Institutes by subscription state"
            emptyMessage="No institutes yet."
          />
        </div>
      </div>
    </div>
  );
}
