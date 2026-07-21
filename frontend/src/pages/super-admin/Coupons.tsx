import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import { confirmDelete } from "../../components/ConfirmModal";

export interface CouponRow {
  id: number;
  code: string;
  discount_type: "percent" | "flat";
  value: string;
  scope: string;
  scope_plan_id: number | null;
  scope_course_id: number | null;
  usage_limit: number | null;
  usage_count: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
}

export function Coupons() {
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (scopeFilter) params.set("scope", scopeFilter);
      if (activeFilter) params.set("is_active", activeFilter);
      const { data } = await apiClient.get<CouponRow[]>(`/super-admin/coupons?${params}`);
      setCoupons(data);
      setError(null);
    } catch {
      setError("Failed to load coupons.");
    } finally {
      setLoading(false);
    }
  }, [search, scopeFilter, activeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(coupon: CouponRow) {
    setError(null);
    const action = coupon.is_active ? "deactivate" : "reactivate";
    try {
      await apiClient.post(`/super-admin/coupons/${coupon.id}/${action}`);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, `Failed to ${action} coupon.`));
    }
  }

  async function remove(coupon: CouponRow) {
    if (!await confirmDelete(`Are you sure you want to delete coupon "${coupon.code}"? This action cannot be undone.`, "Delete Coupon")) return;
    setError(null);
    try {
      await apiClient.delete(`/super-admin/coupons/${coupon.id}`);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to delete coupon."));
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Coupons</h1>
        <Link to="/super-admin/coupons/new" className="button-link">+ New Coupon</Link>
      </div>

      <div className="filter-bar">
        <input placeholder="Search code..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value)}>
          <option value="">All scopes</option>
          <option value="all">All plans</option>
          <option value="plan">Specific plan</option>
          <option value="course">Specific course</option>
        </select>
        <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
          <option value="">Any status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Discount</th>
              <th>Scope</th>
              <th>Usage</th>
              <th>Valid window</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {coupons.length === 0 && (
              <tr><td colSpan={7} className="empty-cell">No coupons match these filters.</td></tr>
            )}
            {coupons.map((coupon) => (
              <tr key={coupon.id}>
                <td><strong>{coupon.code}</strong></td>
                <td>{coupon.discount_type === "percent" ? `${coupon.value}%` : `₹${coupon.value}`}</td>
                <td>{coupon.scope}</td>
                <td>{coupon.usage_count}{coupon.usage_limit ? ` / ${coupon.usage_limit}` : ""}</td>
                <td className="hint">
                  {coupon.valid_from ? new Date(coupon.valid_from).toLocaleDateString() : "—"}
                  {" – "}
                  {coupon.valid_until ? new Date(coupon.valid_until).toLocaleDateString() : "—"}
                </td>
                <td>
                  <span className={`badge ${coupon.is_active ? "badge-green" : "badge-gray"}`}>
                    {coupon.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="table-actions">
                  <Link to={`/super-admin/coupons/${coupon.id}`}>Edit</Link>
                  <button onClick={() => toggleActive(coupon)}>
                    {coupon.is_active ? "Deactivate" : "Reactivate"}
                  </button>
                  <button className="danger" onClick={() => remove(coupon)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
