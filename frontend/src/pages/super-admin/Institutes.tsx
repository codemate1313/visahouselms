import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import { ConfirmModal } from "../../components/ConfirmModal";

interface InstituteRow {
  id: number;
  name: string;
  slug: string;
  contact_email: string | null;
  is_active: boolean;
  subscription_state: string;
  created_at: string;
  onboarding_status: "draft" | "published";
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
  const [search, setSearch] = useState("");
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

  const filteredRows = rows.filter(
    (row) =>
      row.name.toLowerCase().includes(search.toLowerCase()) ||
      row.slug.toLowerCase().includes(search.toLowerCase()) ||
      (row.contact_email && row.contact_email.toLowerCase().includes(search.toLowerCase()))
  );

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

  const [deletingRow, setDeletingRow] = useState<InstituteRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function handleConfirmDelete() {
    if (!deletingRow) return;
    setError(null);
    setDeleteLoading(true);
    try {
      await apiClient.delete(`/super-admin/institutes/${deletingRow.id}`);
      setDeletingRow(null);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to delete institute."));
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Institutes</h1>
        <Link to="/super-admin/onboarding/new" className="button-link">Onboard Institute</Link>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="filter-bar">
        <div className="search-input-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search institutes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ fontSize: "13px", color: "#64748b" }}>
          Showing <strong>{filteredRows.length}</strong> entries
        </div>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="sortable">Institute Name</th>
                <th className="sortable">Slug</th>
                <th>Contact</th>
                <th>Subscription</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 && (
                <tr><td colSpan={6} className="empty-cell">No institutes found matching your query.</td></tr>
              )}
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="table-item-cell">
                      <div className="table-avatar-tile">
                        {row.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="table-item-details">
                        <span className="table-item-title">{row.name}</span>
                        <span className="table-item-subtitle">ID: #{row.id}</span>
                      </div>
                    </div>
                  </td>
                <td className="hint">{row.slug}</td>
                <td>{row.contact_email ?? "—"}</td>
                <td>
                  <span className={`badge ${STATE_BADGES[row.subscription_state] ?? "badge-gray"}`}>
                    {row.subscription_state}
                  </span>
                </td>
                <td>
                  <span className={`badge ${row.is_active ? "badge-green" : "badge-gray"}`}>
                    {row.onboarding_status === "draft" ? "Draft" : row.is_active ? "Active" : "Suspended"}
                  </span>
                </td>
                <td className="table-actions">
                  <Link to={`/super-admin/institutes/${row.id}`}>Edit</Link>
                  <Link to={`/super-admin/institutes/${row.id}/students`}>Students</Link>
                  <Link to={`/super-admin/institutes/${row.id}/branding`}>Branding</Link>
                  <button onClick={() => toggleActive(row)}>
                    {row.is_active ? "Suspend" : "Reactivate"}
                  </button>
                  <button className="danger" onClick={() => setDeletingRow(row)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deletingRow)}
        title="Delete Institute"
        message={deletingRow ? `Are you sure you want to delete institute "${deletingRow.name}"? This action cannot be undone.` : ""}
        confirmText="Delete Institute"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingRow(null)}
      />
    </div>
  );
}
