import { type ReactNode, useEffect, useState } from "react";
import { apiClient } from "../../api/client";
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
    courses_total: number;
    courses_published: number;
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
  active: "var(--success)",
  grace: "var(--warning)",
  expired: "var(--danger)",
  none: "var(--text-muted)",
};

const SUBSCRIPTION_STATE_LABELS: Record<string, string> = {
  active: "Active",
  grace: "In grace",
  expired: "Expired",
  none: "No plan",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  paid: "var(--success)",
  partial: "var(--warning)",
  pending: "#64748b",
  failed: "var(--danger)",
  refunded: "#6b7280",
};

type StatIcon = "building" | "subscription" | "revenue" | "due" | "transactions" | "demo" | "instructors" | "courses";

function formatMoney(value: number): string {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function StatIcon({ icon }: { icon: StatIcon }) {
  const paths: Record<StatIcon, ReactNode> = {
    building: <><path d="M4 21V7.5L12 3l8 4.5V21" /><path d="M9 21v-7h6v7" /><path d="M8 9h.01M12 9h.01M16 9h.01M8 12h.01M16 12h.01" /></>,
    subscription: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M7 9h10M7 13h5" /><path d="M16 14.5l1.3 1.3L20 13" /></>,
    revenue: <><path d="M6 4h12" /><path d="M6 8h12" /><path d="M9 4c4.2 0 6.4 2.1 6.4 5.1S13 15 8 15l7 5" /><path d="M6 15h9" /></>,
    due: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /><path d="M5 5l2 2M19 5l-2 2" /></>,
    transactions: <><path d="M7 7h13l-3-3" /><path d="M17 17H4l3 3" /><path d="M20 7l-3 3" /><path d="M4 17l3-3" /></>,
    demo: <><rect x="4" y="5" width="16" height="11" rx="2" /><path d="M9 20h6" /><path d="M12 16v4" /><path d="M10 9l4 2-4 2V9z" /></>,
    instructors: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M17 8h4M19 6v4M17 14h4" /></>,
    courses: <><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z" /><path d="M8 4v13a3 3 0 0 0 3 3" /><path d="M9 8h6M9 12h5" /></>,
  };

  return <span className={`stat-icon stat-icon-${icon}`} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{paths[icon]}</svg></span>;
}

function StatTile({ icon, label, value, valueClassName = "" }: { icon: StatIcon; label: string; value: string | number; valueClassName?: string }) {
  return <div className="stat-tile">
    <div className="stat-label"><StatIcon icon={icon} /><span>{label}</span></div>
    <p className={`stat-value${valueClassName ? ` ${valueClassName}` : ""}`}>{value}</p>
  </div>;
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
          <span className="page-eyebrow">Platform overview</span>
          <h1>Dashboard</h1>
          <p className="page-subtitle">A concise view of institutes, subscriptions, and platform revenue.</p>
        </div>
      </div>

      <div className="stat-tile-row">
        <StatTile icon="building" label="Institutes" value={counts.institutes_total} />
        <StatTile icon="subscription" label="Active subscriptions" value={counts.subscriptions_active} />
        <StatTile icon="revenue" label="Total revenue" value={formatMoney(Number(revenue.total_revenue))} />
        <StatTile icon="due" label="Total due" value={formatMoney(Number(revenue.total_due))} valueClassName="due-text" />
        <StatTile icon="transactions" label="Transactions" value={revenue.transaction_count} />
        <StatTile icon="demo" label="Active demos" value={counts.demo_accounts_active} />
        <StatTile icon="instructors" label="SA instructors" value={counts.sa_instructor_accounts} />
        <StatTile icon="courses" label="Published courses" value={counts.courses_published} />
      </div>

      <div className="dashboard-charts-grid">
        <div>
          <h2 className="section-title">Revenue by institute</h2>
          <BarChart
            data={institutesByRevenue}
            orientation="horizontal"
            color="var(--series-1)"
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
            color="var(--series-1)"
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
