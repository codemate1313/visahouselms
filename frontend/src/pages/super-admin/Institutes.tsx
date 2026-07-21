import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";

interface InstituteRow {
  id: number;
  name: string;
  slug: string;
  contact_email: string | null;
  is_active: boolean;
  subscription_state: string;
  created_at: string;
}

const STATE_BADGES: Record<string, string> = {
  active: "badge-green",
  grace: "badge-amber",
  expired: "badge-red",
  none: "badge-gray",
};

export function Institutes() {
  const [rows, setRows] = useState<InstituteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<InstituteRow[]>("/super-admin/institutes");
      setRows(data);
      setError(null);
    } catch {
      setError("Failed to load institutes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(row: InstituteRow) {
    setError(null);
    const action = row.is_active ? "suspend" : "reactivate";
    try {
      await apiClient.post(`/super-admin/institutes/${row.id}/${action}`);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, `Failed to ${action} institute.`));
    }
  }

  async function remove(row: InstituteRow) {
    if (!window.confirm(`Delete institute "${row.name}"? This cannot be undone.`)) return;
    setError(null);
    try {
      await apiClient.delete(`/super-admin/institutes/${row.id}`);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to delete institute."));
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Institutes</h1>
        <Link to="/super-admin/institutes/new" className="button-link">+ New Institute</Link>
      </div>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Contact</th>
              <th>Subscription</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="empty-cell">No institutes yet.</td></tr>
            )}
            {rows.map((row) => (
              <tr key={row.id}>
                <td><strong>{row.name}</strong></td>
                <td className="hint">{row.slug}</td>
                <td>{row.contact_email ?? "—"}</td>
                <td>
                  <span className={`badge ${STATE_BADGES[row.subscription_state] ?? "badge-gray"}`}>
                    {row.subscription_state}
                  </span>
                </td>
                <td>
                  <span className={`badge ${row.is_active ? "badge-green" : "badge-gray"}`}>
                    {row.is_active ? "Active" : "Suspended"}
                  </span>
                </td>
                <td className="table-actions">
                  <Link to={`/super-admin/institutes/${row.id}`}>Edit</Link>
                  <Link to={`/super-admin/institutes/${row.id}/students`}>Students</Link>
                  <Link to={`/super-admin/institutes/${row.id}/branding`}>Branding</Link>
                  <button onClick={() => toggleActive(row)}>
                    {row.is_active ? "Suspend" : "Reactivate"}
                  </button>
                  <button className="danger" onClick={() => remove(row)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
