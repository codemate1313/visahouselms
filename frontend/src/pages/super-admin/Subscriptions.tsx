import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import { SearchableSelect } from "../../components/SearchableSelect";
import type { PlanRow } from "./Plans";

interface InstituteRow {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
}

interface SubscriptionInfo {
  id: number;
  plan_id: number;
  plan_name: string | null;
  starts_at: string;
  expires_at: string;
  grace_days: number;
  cancelled_at: string | null;
  state: string;
  days_remaining: number | null;
  created_at: string;
}

interface StatusResponse {
  subscription: SubscriptionInfo | null;
  state: string;
  usage: Record<string, number>;
  limits: Record<string, number> | null;
}

const STATE_BADGES: Record<string, string> = {
  active: "badge-green",
  grace: "badge-amber",
  expired: "badge-red",
  cancelled: "badge-gray",
  none: "badge-gray",
};

const STATE_LABELS: Record<string, string> = {
  active: "Active",
  grace: "In grace period",
  expired: "Expired",
  cancelled: "Cancelled",
  none: "No subscription",
};

// Pure SVG Donut/Pie Chart Component
function QuotaPieChart({ usage, limits }: { usage: Record<string, number>; limits: Record<string, number> }) {
  const studentUsed = usage.students ?? 0;
  const studentLimit = limits.students ?? 0;
  const staffUsed = usage.staff ?? 0;
  const staffLimit = limits.staff ?? 0;
  const testUsed = usage.tests ?? 0;
  const testLimit = limits.tests ?? 0;

  const totalUsed = studentUsed + staffUsed + testUsed;
  const totalLimit = studentLimit + staffLimit + testLimit;
  const overallPercent = totalLimit > 0 ? Math.min(100, Math.round((totalUsed / totalLimit) * 100)) : 0;

  const studentPercent = studentLimit > 0 ? Math.min(100, Math.round((studentUsed / studentLimit) * 100)) : 0;
  const staffPercent = staffLimit > 0 ? Math.min(100, Math.round((staffUsed / staffLimit) * 100)) : 0;
  const testPercent = testLimit > 0 ? Math.min(100, Math.round((testUsed / testLimit) * 100)) : 0;

  // SVG Ring calculation
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (overallPercent / 100) * circumference;

  return (
    <div className="quota-analytics-card">
      <h3 className="analytics-card-title">Quota Utilization</h3>
      
      <div className="donut-pie-row">
        <div className="donut-chart-wrap">
          <svg width="110" height="110" viewBox="0 0 100 100" className="donut-svg">
            <circle cx="50" cy="50" r={radius} className="donut-bg" />
            <circle
              cx="50"
              cy="50"
              r={radius}
              className="donut-fill"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
            />
          </svg>
          <div className="donut-center-text">
            <span className="donut-value">{totalUsed}</span>
            <span className="donut-sublabel">/ {totalLimit}</span>
          </div>
        </div>

        <div className="donut-legend">
          <div className="legend-item">
            <span className="legend-dot dot-students" />
            <div className="legend-info">
              <span className="legend-name">Students</span>
              <strong className="legend-stat">{studentUsed} / {studentLimit} ({studentPercent}%)</strong>
            </div>
          </div>
          <div className="legend-item">
            <span className="legend-dot dot-staff" />
            <div className="legend-info">
              <span className="legend-name">Instructors</span>
              <strong className="legend-stat">{staffUsed} / {staffLimit} ({staffPercent}%)</strong>
            </div>
          </div>
          <div className="legend-item">
            <span className="legend-dot dot-tests" />
            <div className="legend-info">
              <span className="legend-name">Assigned Tests</span>
              <strong className="legend-stat">{testUsed} / {testLimit} ({testPercent}%)</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Validity Circular Ring Gauge
function ValidityGauge({ daysRemaining, state }: { daysRemaining: number | null; state: string }) {
  const days = daysRemaining ?? 0;
  const maxDays = 365;
  const percent = Math.min(100, Math.max(0, Math.round((days / maxDays) * 100)));
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  const strokeColor = state === "active" ? "#16a34a" : state === "grace" ? "#d97706" : "#dc2626";

  return (
    <div className="validity-gauge-card">
      <h3 className="analytics-card-title">Subscription Health</h3>
      <div className="gauge-row">
        <div className="gauge-chart-wrap">
          <svg width="90" height="90" viewBox="0 0 90 90" className="gauge-svg">
            <circle cx="45" cy="45" r={radius} className="gauge-bg" />
            <circle
              cx="45"
              cy="45"
              r={radius}
              className="gauge-fill"
              stroke={strokeColor}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
            />
          </svg>
          <div className="gauge-center-text">
            <span className="gauge-days">{days}</span>
            <span className="gauge-label">days</span>
          </div>
        </div>
        <div className="gauge-info-text">
          <span className={`badge ${STATE_BADGES[state]}`} style={{ width: "max-content", marginBottom: 6 }}>
            {STATE_LABELS[state] ?? state}
          </span>
          <p className="gauge-desc">
            {state === "active"
              ? "Plan active with full portal access."
              : state === "grace"
              ? "Grace period active. Please renew."
              : "Subscription expired."}
          </p>
        </div>
      </div>
    </div>
  );
}

export function Subscriptions() {
  const [institutes, setInstitutes] = useState<InstituteRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [history, setHistory] = useState<SubscriptionInfo[]>([]);
  const [planChoice, setPlanChoice] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiClient.get("/super-admin/institutes").then(({ data }) => {
      setInstitutes(data);
      if (data.length > 0) setSelected(data[0].id);
    });
    apiClient.get("/super-admin/plans").then(({ data }) => setPlans(data));
  }, []);

  const load = useCallback(async () => {
    if (selected === null) return;
    try {
      const [statusRes, historyRes] = await Promise.all([
        apiClient.get(`/super-admin/institutes/${selected}/subscription`),
        apiClient.get(`/super-admin/institutes/${selected}/subscriptions`),
      ]);
      setStatus(statusRes.data);
      setHistory(historyRes.data);
      setError(null);
    } catch {
      setError("Failed to load subscription details.");
    }
  }, [selected]);

  useEffect(() => {
    setNotice(null);
    load();
  }, [load]);

  async function assign() {
    if (!selected || !planChoice) return;
    setError(null); setNotice(null); setBusy(true);
    try {
      await apiClient.post(`/super-admin/institutes/${selected}/subscription`, {
        plan_id: Number(planChoice),
      });
      setNotice("Plan assigned successfully.");
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to assign plan."));
    } finally {
      setBusy(false);
    }
  }

  async function renew() {
    if (!selected) return;
    setError(null); setNotice(null); setBusy(true);
    try {
      await apiClient.post(`/super-admin/institutes/${selected}/subscription/renew`, {
        plan_id: planChoice ? Number(planChoice) : null,
      });
      setNotice("Subscription renewed successfully.");
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to renew."));
    } finally {
      setBusy(false);
    }
  }

  async function cancel(subscriptionId: number) {
    if (!window.confirm("Are you sure you want to cancel this subscription?")) return;
    setError(null); setNotice(null);
    try {
      await apiClient.post(`/super-admin/subscriptions/${subscriptionId}/cancel`);
      setNotice("Subscription cancelled.");
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to cancel."));
    }
  }

  const current = status?.subscription ?? null;
  const state = status?.state ?? "none";
  const selectedInstitute = institutes.find((i) => i.id === selected);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Subscriptions</h1>
          <p className="page-subtitle">Manage plan allocation, renewals, and resource quotas for institutes.</p>
        </div>
      </div>

      <div className="filter-bar institutes-filter-bar" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Institute:
          </span>
          <div style={{ width: 260 }}>
            <SearchableSelect
              options={institutes.map((inst) => ({
                value: String(inst.id),
                label: inst.name,
              }))}
              value={selected ? String(selected) : ""}
              onChange={(val) => setSelected(Number(val))}
              placeholder="Select institute..."
              searchPlaceholder="Search institute name..."
            />
          </div>
        </div>
      </div>

      {institutes.length === 0 && <p className="hint">No institutes available.</p>}
      {error && <p className="error-text">{error}</p>}
      {notice && <p className="success-text">{notice}</p>}

      {status && selectedInstitute && (
        <div className="form-card wide subscription-manage-card-v2">
          <div className="subscription-card-grid">
            {/* LEFT COLUMN: Plan Info & Actions */}
            <div className="sub-card-col-left">
              <div className="subscription-head-v2">
                <span className="table-item-subtitle" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
                  {selectedInstitute.name}
                </span>
                <h2 className="subscription-plan-title">{current?.plan_name ?? "No Active Plan"}</h2>
                <span className={`badge ${STATE_BADGES[state]}`}>{STATE_LABELS[state] ?? state}</span>
              </div>

              {current && state !== "none" && (
                <div className="subscription-dates-box">
                  <p><span>Starts:</span> <strong>{new Date(current.starts_at).toLocaleDateString("en-GB")}</strong></p>
                  <p><span>Expires:</span> <strong>{new Date(current.expires_at).toLocaleDateString("en-GB")}</strong></p>
                  {current.days_remaining != null && (
                    <p>
                      <span>{state === "grace" ? "Grace days left:" : "Days left:"}</span>{" "}
                      <strong className="highlight-days">{current.days_remaining}</strong>
                    </p>
                  )}
                </div>
              )}

              <div className="subscription-actions-bar-v2">
                <div style={{ width: "100%", marginBottom: 12 }}>
                  <SearchableSelect
                    options={[
                      { value: "", label: state === "none" ? "Select a plan..." : "Same plan" },
                      ...plans
                        .filter((p) => p.is_active)
                        .map((plan) => ({
                          value: String(plan.id),
                          label: `${plan.name} (${plan.currency || "INR"} ${plan.price} / ${plan.duration_days}d)`,
                        })),
                    ]}
                    value={planChoice}
                    onChange={(val) => setPlanChoice(String(val))}
                    placeholder={state === "none" ? "Select a plan..." : "Same plan"}
                    searchable={false}
                  />
                </div>

                {state === "none" ? (
                  <button
                    type="button"
                    className="button-link primary-submit-btn"
                    disabled={busy || !planChoice}
                    onClick={assign}
                    style={{ width: "100%" }}
                  >
                    {busy ? "Assigning..." : "Assign plan"}
                  </button>
                ) : (
                  <div className="actions-button-group" style={{ width: "100%" }}>
                    <button
                      type="button"
                      className="button-link primary-submit-btn"
                      disabled={busy}
                      onClick={renew}
                      style={{ flex: 1 }}
                    >
                      {busy ? "Renewing..." : "Renew"}
                    </button>
                    {current && !current.cancelled_at && (
                      <button
                        type="button"
                        className="danger-cancel-btn"
                        disabled={busy}
                        onClick={() => cancel(current.id)}
                        style={{ flex: 1 }}
                      >
                        Cancel subscription
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: Interactive Donut Pie Chart & Health Gauge */}
            <div className="sub-card-col-right">
              {status.limits && <QuotaPieChart usage={status.usage} limits={status.limits} />}
              <ValidityGauge daysRemaining={current?.days_remaining ?? null} state={state} />
            </div>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 className="section-title" style={{ marginBottom: 16 }}>Subscription History</h2>
          <div className="table-wrap">
            <table className="data-table sleek-institutes-table">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Starts</th>
                  <th>Expires</th>
                  <th>State</th>
                  <th className="table-actions-heading" style={{ textAlign: "center", width: 110, minWidth: 110 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong style={{ fontSize: 13.5 }}>{row.plan_name ?? "Subscription Plan"}</strong>
                    </td>
                    <td>{new Date(row.starts_at).toLocaleDateString("en-GB")}</td>
                    <td>{new Date(row.expires_at).toLocaleDateString("en-GB")}</td>
                    <td>
                      <span className={`badge ${STATE_BADGES[row.state] ?? "badge-gray"}`}>
                        {STATE_LABELS[row.state] ?? row.state}
                      </span>
                    </td>
                    <td className="table-actions" style={{ justifyContent: "center" }}>
                      {!row.cancelled_at && (row.state === "active" || row.state === "grace") ? (
                        <button
                          type="button"
                          className="danger-cancel-btn"
                          style={{ padding: "5px 12px", fontSize: 12 }}
                          onClick={() => cancel(row.id)}
                          data-tooltip="Cancel Subscription"
                        >
                          Cancel
                        </button>
                      ) : (
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
