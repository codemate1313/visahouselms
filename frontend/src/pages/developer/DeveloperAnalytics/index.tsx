import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { BarChart } from "@/components/charts/BarChart";
import { DEVELOPER_ACCESS_SLUG } from "@/config/developerAccess";
import { PageHeader } from "@/components/ui";
import "./DeveloperAnalytics.css";

const developerSlug = DEVELOPER_ACCESS_SLUG;

interface Overview {
  money: {
    total_collected: string;
    b2b_collected: string;
    b2c_collected: string;
    outstanding_due: string;
    transaction_count: number;
    currency: string;
  };
  people: {
    students: number;
    institute_admins: number;
    institute_instructors: number;
    sa_instructors: number;
    total: number;
    enrollments: number;
  };
  platform: {
    active_institutes: number;
    total_institutes: number;
    active_subscriptions: number;
  };
  traffic: {
    window_days: number;
    total_views: number;
    total_clicks: number;
    unique_visitors: number;
    views_per_day: { day: string; views: number }[];
    top_pages: { path: string; views: number }[];
    top_clicks: { label: string; clicks: number }[];
    unavailable?: boolean;
  };
}

function money(amount: string, currency: string) {
  const value = Number(amount || "0");
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export function DeveloperAnalytics() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<Overview>(`/developer/${developerSlug}/analytics/overview`, { params: { traffic_days: 30 } })
      .then(({ data }) => {
        setData(data);
        setError(null);
      })
      .catch((err: unknown) => setError(extractErrorMessage(err, "Could not load platform analytics.")));
  }, []);

  if (error) return <p className="error-text">{error}</p>;
  if (!data) return <p>Loading analytics…</p>;

  const dayChart = data.traffic.views_per_day.map((row) => ({
    label: row.day.slice(5), // MM-DD
    value: row.views,
  }));

  return (
    <div className="developer-analytics">
      <PageHeader
        eyebrow="Platform"
        title="Analytics"
        subtitle="Money, people and traffic across every institute on the platform."
      />

      <section className="dev-metric-grid">
        <article className="dev-metric is-money">
          <span className="dev-metric-label">Total collected</span>
          <strong className="dev-metric-value">{money(data.money.total_collected, data.money.currency)}</strong>
          <span className="dev-metric-sub">{data.money.transaction_count} transactions</span>
        </article>
        <article className="dev-metric">
          <span className="dev-metric-label">Outstanding due</span>
          <strong className="dev-metric-value">{money(data.money.outstanding_due, data.money.currency)}</strong>
          <span className="dev-metric-sub">B2B {money(data.money.b2b_collected, data.money.currency)} · B2C {money(data.money.b2c_collected, data.money.currency)}</span>
        </article>
        <article className="dev-metric">
          <span className="dev-metric-label">People</span>
          <strong className="dev-metric-value">{data.people.total.toLocaleString("en-IN")}</strong>
          <span className="dev-metric-sub">{data.people.students.toLocaleString("en-IN")} students · {data.people.enrollments.toLocaleString("en-IN")} enrollments</span>
        </article>
        <article className="dev-metric">
          <span className="dev-metric-label">Institutes</span>
          <strong className="dev-metric-value">{data.platform.active_institutes}/{data.platform.total_institutes}</strong>
          <span className="dev-metric-sub">{data.platform.active_subscriptions} active subscriptions</span>
        </article>
      </section>

      {data.traffic.unavailable && (
        <p className="dev-traffic-warning">
          Traffic tracking isn&rsquo;t active yet. Run the database migration
          (<code>alembic upgrade head</code>) to start collecting page views.
        </p>
      )}

      <section className="dev-traffic-grid">
        <article className="dev-metric is-compact">
          <span className="dev-metric-label">Page views (30d)</span>
          <strong className="dev-metric-value">{data.traffic.total_views.toLocaleString("en-IN")}</strong>
        </article>
        <article className="dev-metric is-compact">
          <span className="dev-metric-label">Unique visitors</span>
          <strong className="dev-metric-value">{data.traffic.unique_visitors.toLocaleString("en-IN")}</strong>
        </article>
        <article className="dev-metric is-compact">
          <span className="dev-metric-label">Clicks tracked</span>
          <strong className="dev-metric-value">{data.traffic.total_clicks.toLocaleString("en-IN")}</strong>
        </article>
      </section>

      {dayChart.length > 0 && (
        <section className="form-card wide">
          <BarChart
            data={dayChart}
            title="Page views per day"
            ariaLabel="Page views per day over the last 30 days"
            formatValue={(v) => v.toLocaleString("en-IN")}
          />
        </section>
      )}

      <div className="dev-list-grid">
        <section className="form-card wide">
          <h3 className="dev-list-title">Top pages</h3>
          {data.traffic.top_pages.length === 0 ? (
            <p className="hint">No traffic recorded yet.</p>
          ) : (
            <ul className="dev-rank-list">
              {data.traffic.top_pages.map((row) => (
                <li key={row.path}>
                  <span className="dev-rank-name">{row.path}</span>
                  <span className="dev-rank-value">{row.views.toLocaleString("en-IN")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="form-card wide">
          <h3 className="dev-list-title">Top clicks</h3>
          {data.traffic.top_clicks.length === 0 ? (
            <p className="hint">No named clicks recorded yet.</p>
          ) : (
            <ul className="dev-rank-list">
              {data.traffic.top_clicks.map((row) => (
                <li key={row.label}>
                  <span className="dev-rank-name">{row.label}</span>
                  <span className="dev-rank-value">{row.clicks.toLocaleString("en-IN")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
