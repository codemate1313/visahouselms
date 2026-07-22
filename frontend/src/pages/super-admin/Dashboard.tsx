import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiClient } from "../../api/client";
import { AnimatedCounter } from "../../components/AnimatedCounter";
import { BarChart } from "../../components/charts/BarChart";
import { DonutChart } from "../../components/charts/DonutChart";
import { CollapsiblePanel } from "../../components/CollapsiblePanel";
import { Icon, type IconName } from "../../components/icons";

type MetricKey =
  | "institutes"
  | "subscriptions"
  | "revenue"
  | "dues"
  | "transactions"
  | "demos"
  | "instructors"
  | "modules";

type DetailValueType = "text" | "number" | "money" | "date";

interface MetricDetailValue {
  label: string;
  value: string | number | null;
  value_type: DetailValueType;
  currency: string | null;
}

interface MetricDetailItem {
  id: string;
  title: string;
  subtitle: string | null;
  status_label: string | null;
  status_tone: "green" | "blue" | "amber" | "red" | "purple" | "slate";
  value: string | number | null;
  value_label: string | null;
  value_type: DetailValueType;
  currency: string | null;
  metadata: MetricDetailValue[];
}

interface MetricDetail {
  metric: MetricKey;
  title: string;
  description: string;
  empty_message: string;
  items: MetricDetailItem[];
}

const METRIC_TITLES: Record<MetricKey, string> = {
  institutes: "Total Institutes",
  subscriptions: "Active Subscriptions",
  revenue: "Total Revenue",
  dues: "Total Due",
  transactions: "Transactions",
  demos: "Active Demos",
  instructors: "SA Instructors",
  modules: "Published Modules",
};

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

function formatDetailValue(
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
      : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }
  return String(value);
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function Sparkline({ theme }: { theme: "green" | "blue" | "amber" | "purple" | "slate" }) {
  const colorMap = {
    green: { stroke: "#10b981", id: "spark-grad-green" },
    blue: { stroke: "#3b82f6", id: "spark-grad-blue" },
    amber: { stroke: "#f59e0b", id: "spark-grad-amber" },
    purple: { stroke: "#8b5cf6", id: "spark-grad-purple" },
    slate: { stroke: "#64748b", id: "spark-grad-slate" },
  };

  const { stroke, id } = colorMap[theme] || colorMap.green;

  return (
    <svg width="72" height="30" viewBox="0 0 72 30" fill="none" className="metric-sparkline">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.3" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path
        d="M 2 22 Q 14 16, 26 20 T 50 12 T 70 4 L 70 30 L 2 30 Z"
        fill={`url(#${id})`}
      />
      <path
        d="M 2 22 Q 14 16, 26 20 T 50 12 T 70 4"
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MetricItem({
  label,
  numericValue,
  badgeText,
  badgeTheme = "green",
  isCurrency = false,
  valueClassName = "",
  metricKey,
  iconName,
  onOpen,
}: {
  label: string;
  numericValue: number;
  badgeText?: string;
  badgeTheme?: "green" | "blue" | "amber" | "purple" | "slate";
  isCurrency?: boolean;
  valueClassName?: string;
  metricKey: MetricKey;
  iconName: IconName;
  onOpen: (metric: MetricKey) => void;
}) {
  return (
    <div 
      className={`metric-card theme-${badgeTheme}`}
      onClick={() => onOpen(metricKey)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(metricKey);
        }
      }}
    >
      <div className="metric-card-header-row">
        <span className="metric-card-label">{label}</span>
        <div className={`metric-card-icon-bubble icon-bg-${badgeTheme}`}>
          <Icon name={iconName} className="metric-card-icon" />
        </div>
      </div>

      <div className="metric-card-value-row">
        <span className={`metric-card-number${valueClassName ? ` ${valueClassName}` : ""}`}>
          <AnimatedCounter
            value={numericValue}
            duration={1200}
            format={isCurrency ? formatMoney : undefined}
          />
        </span>
      </div>

      <div className="metric-card-footer-row">
        {badgeText && (
          <span className={`metric-badge-pill pill-${badgeTheme}`}>
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="metric-pill-arrow"
            >
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
            {badgeText}
          </span>
        )}
        <Sparkline theme={badgeTheme} />
      </div>
    </div>
  );
}

export function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey | null>(null);
  const [metricDetail, setMetricDetail] = useState<MetricDetail | null>(null);
  const [metricLoading, setMetricLoading] = useState(false);
  const [metricError, setMetricError] = useState<string | null>(null);
  const metricRequestId = useRef(0);

  useEffect(() => {
    apiClient
      .get<Summary>("/super-admin/dashboard/summary")
      .then(({ data }) => setSummary(data))
      .catch(() => setError("Failed to load dashboard."));
  }, []);

  useEffect(() => {
    if (!selectedMetric) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedMetric(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedMetric]);

  async function openMetric(metric: MetricKey) {
    const requestId = ++metricRequestId.current;
    setSelectedMetric(metric);
    setMetricDetail(null);
    setMetricError(null);
    setMetricLoading(true);
    try {
      const { data } = await apiClient.get<MetricDetail>(`/super-admin/dashboard/metrics/${metric}`, {
        headers: { "X-Skip-Loader": "true" },
      });
      if (requestId !== metricRequestId.current) return;
      setMetricDetail(data);
    } catch {
      if (requestId !== metricRequestId.current) return;
      setMetricError("Failed to load these details.");
    } finally {
      if (requestId === metricRequestId.current) setMetricLoading(false);
    }
  }

  function closeMetric() {
    metricRequestId.current += 1;
    setSelectedMetric(null);
    setMetricDetail(null);
    setMetricError(null);
  }

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

      {/* Sleek & Interactive Executive Metric Grid */}
      <div className="executive-metric-grid">
        <MetricItem metricKey="institutes" iconName="building" onOpen={openMetric} label="Total Institutes" numericValue={counts.institutes_total} badgeText="Active" badgeTheme="green" />
        <MetricItem metricKey="subscriptions" iconName="subscription" onOpen={openMetric} label="Active Subscriptions" numericValue={counts.subscriptions_active} badgeText="Live" badgeTheme="blue" />
        <MetricItem metricKey="revenue" iconName="revenue" onOpen={openMetric} label="Total Revenue" numericValue={Number(revenue.total_revenue)} isCurrency badgeText="+18% growth" badgeTheme="green" />
        <MetricItem metricKey="dues" iconName="due" onOpen={openMetric} label="Total Due" numericValue={Number(revenue.total_due)} isCurrency valueClassName="due-text" badgeText="Pending" badgeTheme="amber" />
        <MetricItem metricKey="transactions" iconName="transactions" onOpen={openMetric} label="Transactions" numericValue={revenue.transaction_count} badgeText="Settled" badgeTheme="slate" />
        <MetricItem metricKey="demos" iconName="demo" onOpen={openMetric} label="Active Demos" numericValue={counts.demo_accounts_active} badgeText="Demo" badgeTheme="blue" />
        <MetricItem metricKey="instructors" iconName="instructors" onOpen={openMetric} label="SA Instructors" numericValue={counts.sa_instructor_accounts} badgeText="Verified" badgeTheme="green" />
        <MetricItem metricKey="modules" iconName="module" onOpen={openMetric} label="Published Modules" numericValue={counts.modules_published} badgeText="Published" badgeTheme="purple" />
      </div>

      <div className="dashboard-charts-grid">
        <CollapsiblePanel
          className="dashboard-chart-collapsible"
          title="Revenue by institute"
          description="Compare institute contribution across recorded payments."
        >
          <BarChart
            data={institutesByRevenue}
            orientation="horizontal"
            formatValue={formatMoney}
            ariaLabel="Revenue by institute"
            emptyMessage="No revenue recorded yet."
          />
        </CollapsiblePanel>

        <CollapsiblePanel
          className="dashboard-chart-collapsible"
          title="Revenue by month"
          description="Track month-wise platform revenue movement."
        >
          <BarChart
            data={revenueByMonth}
            orientation="vertical"
            formatValue={formatMoney}
            ariaLabel="Revenue by month"
            emptyMessage="No revenue recorded yet."
          />
        </CollapsiblePanel>

        <CollapsiblePanel
          className="dashboard-chart-collapsible"
          title="Payment status"
          description="Review paid and partial payment split."
        >
          <DonutChart
            data={paymentStatusData}
            centerLabel="payments"
            ariaLabel="Payment status breakdown"
            emptyMessage="No payments recorded yet."
          />
        </CollapsiblePanel>

        <CollapsiblePanel
          className="dashboard-chart-collapsible"
          title="Institutes by subscription state"
          description="See active, grace-period, and inactive institutes."
        >
          <BarChart
            data={instituteStateData}
            orientation="vertical"
            legend={instituteStateLegend}
            ariaLabel="Institutes by subscription state"
            emptyMessage="No institutes yet."
          />
        </CollapsiblePanel>
      </div>

      {selectedMetric && createPortal(
        <div className="dashboard-detail-backdrop" onMouseDown={closeMetric}>
          <section
            className="dashboard-detail-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-detail-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="dashboard-detail-header">
              <div>
                <span className="page-eyebrow">Dashboard Detail</span>
                <h2 id="dashboard-detail-title">{metricDetail?.title ?? METRIC_TITLES[selectedMetric]}</h2>
                {metricDetail && <p>{metricDetail.description}</p>}
              </div>
              <button type="button" className="dashboard-detail-close" onClick={closeMetric} aria-label="Close details" title="Close" autoFocus>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="dashboard-close-icon"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </header>

            <div className="dashboard-detail-body">
              {metricLoading && <div className="dashboard-detail-state">Loading details...</div>}
              {metricError && <div className="dashboard-detail-state error-text">{metricError}</div>}
              {metricDetail && metricDetail.items.length === 0 && (
                <div className="dashboard-detail-state">{metricDetail.empty_message}</div>
              )}
              {metricDetail && metricDetail.items.length > 0 && (
                <div className="dashboard-records-list">
                  <div className="records-count-bar">
                    <span className="records-count-label">Total Records</span>
                    <span className="records-count-badge">{metricDetail.items.length}</span>
                  </div>

                  {metricDetail.items.map((item) => (
                    <article className="dashboard-record-card" key={`${metricDetail.metric}-${item.id}`}>
                      <div className="record-card-top">
                        <div className="record-identity">
                          <div className="record-title-group">
                            <h3 className="record-title">{item.title}</h3>
                            {item.status_label && (
                              <span className="record-status-pill" data-tone={item.status_tone}>
                                <span className="status-dot" />
                                {item.status_label}
                              </span>
                            )}
                          </div>
                          {item.subtitle && <p className="record-subtitle">{item.subtitle}</p>}
                        </div>

                        {item.value !== null && (
                          <div className="record-value-box">
                            <strong className="record-value-num">
                              {formatDetailValue(item.value, item.value_type, item.currency)}
                            </strong>
                            {item.value_label && <span className="record-value-lbl">{item.value_label}</span>}
                          </div>
                        )}
                      </div>

                      {item.metadata.length > 0 && (
                        <div className="record-metadata-grid">
                          {item.metadata.map((entry) => (
                            <div className="metadata-chip" key={`${item.id}-${entry.label}`}>
                              <span className="meta-chip-label">{entry.label}</span>
                              <span className="meta-chip-value">
                                {formatDetailValue(entry.value, entry.value_type, entry.currency)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>,
        document.body,
      )}
    </div>
  );
}
