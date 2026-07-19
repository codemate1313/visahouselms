import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
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
      setNotice("Plan assigned.");
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
      setNotice("Subscription renewed.");
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to renew."));
    } finally {
      setBusy(false);
    }
  }

  async function cancel(subscriptionId: number) {
    if (!window.confirm("Cancel this subscription?")) return;
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

  return (
    <div>
      <div className="page-header">
        <h1>Subscriptions</h1>
        <select
          value={selected ?? ""}
          onChange={(e) => setSelected(Number(e.target.value))}
          className="institute-select"
        >
          {institutes.map((inst) => (
            <option key={inst.id} value={inst.id}>{inst.name}</option>
          ))}
        </select>
      </div>

      {institutes.length === 0 && <p className="hint">No institutes yet - institute onboarding arrives in Phase 2.2.</p>}
      {error && <p className="error-text">{error}</p>}
      {notice && <p className="success-text">{notice}</p>}

      {status && (
        <div className="subscription-card">
          <div className="subscription-head">
            <div>
              <h2>{current?.plan_name ?? "No plan"}</h2>
              <span className={`badge ${STATE_BADGES[state]}`}>{STATE_LABELS[state] ?? state}</span>
            </div>
            {current && state !== "none" && (
              <div className="subscription-dates">
                <p><span>Starts:</span> {new Date(current.starts_at).toLocaleDateString()}</p>
                <p><span>Expires:</span> {new Date(current.expires_at).toLocaleDateString()}</p>
                {current.days_remaining != null && (
                  <p>
                    <span>{state === "grace" ? "Grace days left:" : "Days left:"}</span>{" "}
                    {current.days_remaining}
                  </p>
                )}
              </div>
            )}
          </div>

          {status.limits && (
            <div className="usage-bars">
              {(["students", "staff", "tests"] as const).map((resource) => {
                const used = status.usage[resource] ?? 0;
                const limit = status.limits?.[resource] ?? 0;
                const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
                return (
                  <div key={resource} className="usage-bar-row">
                    <span className="usage-label">{resource}</span>
                    <div className="usage-track">
                      <div
                        className={`usage-fill ${percent >= 100 ? "full" : ""}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="usage-count">{used} / {limit}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="subscription-actions">
            <select value={planChoice} onChange={(e) => setPlanChoice(e.target.value)}>
              <option value="">
                {state === "none" ? "Select a plan..." : "Same plan"}
              </option>
              {plans.filter((p) => p.is_active).map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} - {plan.currency} {plan.price} / {plan.duration_days}d
                </option>
              ))}
            </select>
            {state === "none" ? (
              <button disabled={busy || !planChoice} onClick={assign}>Assign plan</button>
            ) : (
              <>
                <button disabled={busy} onClick={renew}>Renew</button>
                {current && !current.cancelled_at && (
                  <button className="danger" disabled={busy} onClick={() => cancel(current.id)}>
                    Cancel subscription
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <>
          <h2 className="section-title">History</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Plan</th><th>Starts</th><th>Expires</th><th>State</th><th></th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.id}>
                  <td>{row.plan_name}</td>
                  <td>{new Date(row.starts_at).toLocaleDateString()}</td>
                  <td>{new Date(row.expires_at).toLocaleDateString()}</td>
                  <td>
                    <span className={`badge ${STATE_BADGES[row.state] ?? "badge-gray"}`}>
                      {STATE_LABELS[row.state] ?? row.state}
                    </span>
                  </td>
                  <td className="table-actions">
                    {!row.cancelled_at && (row.state === "active" || row.state === "grace") && (
                      <button className="danger" onClick={() => cancel(row.id)}>Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
