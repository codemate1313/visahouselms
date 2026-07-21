import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";

export interface PlanRow {
  id: number;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  duration_days: number;
  student_limit: number;
  test_limit: number;
  staff_limit: number;
  grace_days: number;
  is_active: boolean;
  is_published: boolean;
  audience: "both" | "direct_students" | "institutes";
  module_count: number;
  subscription_count: number;
}

export function Plans() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<PlanRow[]>("/super-admin/plans");
      setPlans(data);
      setError(null);
    } catch {
      setError("Failed to load plans.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(plan: PlanRow) {
    setError(null);
    const action = plan.is_active ? "deactivate" : "reactivate";
    try {
      await apiClient.post(`/super-admin/plans/${plan.id}/${action}`);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, `Failed to ${action} plan.`));
    }
  }

  async function remove(plan: PlanRow) {
    if (!window.confirm(`Delete plan "${plan.name}"? This cannot be undone.`)) return;
    setError(null);
    try {
      await apiClient.delete(`/super-admin/plans/${plan.id}`);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to delete plan."));
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Subscription Plans</h1>
        <Link to="/super-admin/plans/new" className="button-link">+ New Plan</Link>
      </div>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Price</th>
              <th>Duration</th>
              <th>Limits (students / staff / tests)</th>
              <th>Grace</th>
              <th>Courses</th>
              <th>Subs</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 && (
              <tr><td colSpan={9} className="empty-cell">No plans yet - create your first plan.</td></tr>
            )}
            {plans.map((plan) => (
              <tr key={plan.id}>
                <td>
                  <strong>{plan.name}</strong>
                  {plan.description && <div className="hint">{plan.description}</div>}
                </td>
                <td>{plan.currency} {plan.price}</td>
                <td>{plan.duration_days} days</td>
                <td>{plan.student_limit} / {plan.staff_limit} / {plan.test_limit}</td>
                <td>{plan.grace_days} days</td>
                <td>{plan.module_count}<div className="hint">direct students</div></td>
                <td>{plan.subscription_count}</td>
                <td>
                  <span className={`badge ${plan.is_active ? "badge-green" : "badge-gray"}`}>
                    {!plan.is_active ? "Inactive" : plan.is_published ? "Published" : "Draft"}
                  </span>
                </td>
                <td className="table-actions">
                  <Link to={`/super-admin/plans/${plan.id}`}>Edit</Link>
                  <button onClick={() => toggleActive(plan)}>
                    {plan.is_active ? "Deactivate" : "Reactivate"}
                  </button>
                  <button className="danger" onClick={() => remove(plan)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
