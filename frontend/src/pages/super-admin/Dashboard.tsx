import { useEffect, useState } from "react";
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

function formatMoney(value: number): string {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
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
    <div>
      <h1>Dashboard</h1>

      <div className="stat-tile-row">
        <div className="stat-tile">
          <p className="stat-label">Institutes</p>
          <p className="stat-value">{counts.institutes_total}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">Active subscriptions</p>
          <p className="stat-value">{counts.subscriptions_active}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">Total revenue</p>
          <p className="stat-value">{formatMoney(Number(revenue.total_revenue))}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">Total due</p>
          <p className="stat-value due-text">{formatMoney(Number(revenue.total_due))}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">Transactions</p>
          <p className="stat-value">{revenue.transaction_count}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">Active demos</p>
          <p className="stat-value">{counts.demo_accounts_active}</p>
        </div>
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
