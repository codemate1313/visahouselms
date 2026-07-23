import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { API_BASE_URL, apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import { ConfirmModal } from "../../components/ConfirmModal";
import { Icon } from "../../components/icons";
import { SearchableSelect } from "../../components/SearchableSelect";
import { ToggleSwitch } from "../../components/ToggleSwitch";

interface InstituteRow {
  id: number;
  name: string;
  slug: string;
  contact_email: string | null;
  logo_url: string | null;
  is_active: boolean;
  subscription_state: string;
  created_at: string;
  onboarding_status: "draft" | "published";
}

type SortKey = "name" | "slug";

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
  const [subscriptionFilter, setSubscriptionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<"ascending" | "descending">("ascending");
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

  const query = search.trim().toLowerCase();
  const filteredRows = rows
    .filter((row) => {
      const matchesSearch =
        !query ||
        row.name.toLowerCase().includes(query) ||
        row.slug.toLowerCase().includes(query) ||
        Boolean(row.contact_email?.toLowerCase().includes(query));

      const matchesSub = !subscriptionFilter || row.subscription_state === subscriptionFilter;

      const activeStatus = row.onboarding_status === "draft" ? "draft" : row.is_active ? "active" : "suspended";
      const matchesStatus = !statusFilter || activeStatus === statusFilter;

      return matchesSearch && matchesSub && matchesStatus;
    })
    .sort((left, right) => {
      const comparison = left[sortKey].localeCompare(right[sortKey]);
      return sortDirection === "ascending" ? comparison : -comparison;
    });

  function changeSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDirection((current) => current === "ascending" ? "descending" : "ascending");
      return;
    }
    setSortKey(nextKey);
    setSortDirection("ascending");
  }

  async function toggleActive(row: InstituteRow) {
    setError(null);
    const action = row.is_active ? "suspend" : "reactivate";
    setRows((current) =>
      current.map((item) => item.id === row.id ? { ...item, is_active: !row.is_active } : item)
    );
    try {
      await apiClient.post(`/super-admin/institutes/${row.id}/${action}`);
    } catch (err: unknown) {
      setRows((current) =>
        current.map((item) => item.id === row.id ? { ...item, is_active: row.is_active } : item)
      );
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

  function exportPDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    // Header block
    doc.setFillColor(185, 28, 43);
    doc.rect(0, 0, 297, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("IELTS LMS — Institutes Report", 14, 13);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleString()}`, 220, 13);

    autoTable(doc, {
      startY: 26,
      head: [["#", "Institute", "Slug", "Contact Email", "Subscription", "Status", "Onboarding"]],
      body: filteredRows.map((row, i) => [
        i + 1,
        row.name,
        row.slug,
        row.contact_email ?? "—",
        row.subscription_state,
        row.onboarding_status === "draft" ? "Draft" : row.is_active ? "Active" : "Suspended",
        row.onboarding_status,
      ]),
      styles: {
        fontSize: 9,
        cellPadding: 4,
        textColor: [15, 23, 42],
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9,
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        3: { cellWidth: 55 },
      },
    });

    doc.save(`institutes-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  function exportExcel() {
    const wsData = [
      ["#", "Institute Name", "Slug", "Contact Email", "Subscription", "Status", "Onboarding", "Created At"],
      ...filteredRows.map((row, i) => [
        i + 1,
        row.name,
        row.slug,
        row.contact_email ?? "",
        row.subscription_state,
        row.onboarding_status === "draft" ? "Draft" : row.is_active ? "Active" : "Suspended",
        row.onboarding_status,
        new Date(row.created_at).toLocaleDateString(),
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [
      { wch: 5 }, { wch: 28 }, { wch: 20 }, { wch: 34 },
      { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Institutes");
    XLSX.writeFile(wb, `institutes-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Institutes</h1>
        <Link to="/super-admin/onboarding/new" className="button-link">Onboard Institute</Link>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="filter-bar institutes-filter-bar">
        <div className="search-input-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="search-icon">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search name, slug, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" className="clear-search-btn" onClick={() => setSearch("")} aria-label="Clear search">
              ✕
            </button>
          )}
        </div>

        <SearchableSelect
          options={[
            { value: "", label: "All subscriptions" },
            { value: "active", label: "Active" },
            { value: "grace", label: "Grace period" },
            { value: "expired", label: "Expired" },
          ]}
          value={subscriptionFilter}
          onChange={(val) => setSubscriptionFilter(String(val))}
          placeholder="All subscriptions"
          searchable={false}
          className="status-filter-select"
        />

        <SearchableSelect
          options={[
            { value: "", label: "All statuses" },
            { value: "active", label: "Active" },
            { value: "suspended", label: "Suspended" },
            { value: "draft", label: "Draft" },
          ]}
          value={statusFilter}
          onChange={(val) => setStatusFilter(String(val))}
          placeholder="All statuses"
          searchable={false}
          className="status-filter-select"
        />

        <div className="export-btn-group">
          <button type="button" className="export-btn export-pdf" onClick={exportPDF} data-tooltip="Export PDF">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="M12 18v-6" />
              <path d="m9 15 3 3 3-3" />
            </svg>
          </button>
          <button type="button" className="export-btn export-excel" onClick={exportExcel} data-tooltip="Export Excel">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M3 9h18" />
              <path d="M3 15h18" />
              <path d="M9 3v18" />
              <path d="M15 3v18" />
            </svg>
          </button>
        </div>

        <div className="filter-result-count">
          Showing <strong>{filteredRows.length}</strong> {filteredRows.length === 1 ? "entry" : "entries"}
        </div>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table sleek-institutes-table">
            <thead>
              <tr>
                <th aria-sort={sortKey === "name" ? sortDirection : "none"}>
                  <button type="button" className="table-sort-button" onClick={() => changeSort("name")}>Institute</button>
                </th>
                <th aria-sort={sortKey === "slug" ? sortDirection : "none"}>
                  <button type="button" className="table-sort-button" onClick={() => changeSort("slug")}>Contact & Slug</button>
                </th>
                <th>Subscription</th>
                <th>Status</th>
                <th className="table-actions-heading" style={{ textAlign: "right", paddingRight: 24 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 && (
                <tr><td colSpan={5} className="empty-cell">No institutes found matching your query.</td></tr>
              )}
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="table-item-cell">
                      <div className="table-avatar-tile">
                        {row.logo_url ? (
                          <img src={`${API_BASE_URL}${row.logo_url}`} alt={`${row.name} logo`} />
                        ) : (
                          row.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="table-item-details">
                        <span className="table-item-title">{row.name}</span>
                        <span className="table-item-subtitle">ID: #{row.id}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="table-item-details">
                      <span className="table-item-title" style={{ fontSize: 13, fontWeight: 500 }}>{row.contact_email ?? "—"}</span>
                      <span className="table-item-subtitle" style={{ fontSize: 11.5, color: "var(--slate-400)" }}>slug: {row.slug}</span>
                    </div>
                  </td>
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
                  <td className="table-actions institute-row-actions" style={{ paddingRight: 24 }}>
                    <ToggleSwitch
                      checked={row.is_active}
                      onChange={() => toggleActive(row)}
                      tooltip={row.is_active ? "Suspend Institute" : "Reactivate Institute"}
                    />
                    <Link className="action-btn-icon action-edit" to={`/super-admin/institutes/${row.id}`} data-tooltip="Edit Institute">
                      <Icon name="edit" />
                    </Link>
                    <Link className="action-btn-icon action-students" to={`/super-admin/institutes/${row.id}/students`} data-tooltip="Manage Students">
                      <Icon name="user" />
                    </Link>
                    <Link className="action-btn-icon action-branding" to={`/super-admin/institutes/${row.id}/branding`} data-tooltip="Institute Branding">
                      <Icon name="settings" />
                    </Link>
                    <button className="action-btn-icon danger action-delete" onClick={() => setDeletingRow(row)} data-tooltip="Delete Institute">
                      <Icon name="trash" />
                    </button>
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
