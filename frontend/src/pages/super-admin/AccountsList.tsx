import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import type { SuperAdminAccount } from "../../api/types";
import { ConfirmModal } from "../../components/ConfirmModal";
import { Icon } from "../../components/icons";
import { SearchableSelect } from "../../components/SearchableSelect";
import { ToggleSwitch } from "../../components/ToggleSwitch";
import { useAuthStore } from "../../store/authStore";

export function AccountsList() {
  const currentUser = useAuthStore((state) => state.user);
  const [accounts, setAccounts] = useState<SuperAdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deletingAccount, setDeletingAccount] = useState<SuperAdminAccount | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function loadAccounts() {
    setLoading(true);
    try {
      const { data } = await apiClient.get<SuperAdminAccount[]>("/super-admin/accounts");
      setAccounts(data);
      setError(null);
    } catch {
      setError("Failed to load accounts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  const query = search.trim().toLowerCase();
  const filteredAccounts = accounts.filter((account) => {
    const fullName = `${account.first_name} ${account.last_name}`.toLowerCase();
    const matchesSearch = !query || fullName.includes(query) || account.email.toLowerCase().includes(query);
    const matchesStatus = !statusFilter || (statusFilter === "active" ? account.is_active : !account.is_active);
    return matchesSearch && matchesStatus;
  });

  async function handleToggleActive(account: SuperAdminAccount) {
    setError(null);
    const action = account.is_active ? "deactivate" : "reactivate";
    setAccounts((current) =>
      current.map((item) => item.id === account.id ? { ...item, is_active: !account.is_active } : item)
    );
    try {
      await apiClient.post(`/super-admin/accounts/${account.id}/${action}`);
    } catch (err: unknown) {
      setAccounts((current) =>
        current.map((item) => item.id === account.id ? { ...item, is_active: account.is_active } : item)
      );
      setError(extractErrorMessage(err, `Failed to ${action} account.`));
    }
  }

  async function handleForceReset(account: SuperAdminAccount) {
    setError(null);
    setAccounts((current) =>
      current.map((item) =>
        item.id === account.id ? { ...item, force_password_reset: !account.force_password_reset } : item
      )
    );
    try {
      await apiClient.post(`/super-admin/accounts/${account.id}/force-password-reset`, {
        enabled: !account.force_password_reset,
      });
    } catch (err: unknown) {
      setAccounts((current) =>
        current.map((item) =>
          item.id === account.id ? { ...item, force_password_reset: account.force_password_reset } : item
        )
      );
      setError(extractErrorMessage(err, "Failed to update password-reset requirement."));
    }
  }

  async function handleConfirmDelete() {
    if (!deletingAccount) return;
    setError(null);
    setDeleteLoading(true);
    try {
      await apiClient.delete(`/super-admin/accounts/${deletingAccount.id}`);
      setDeletingAccount(null);
      await loadAccounts();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to delete account."));
    } finally {
      setDeleteLoading(false);
    }
  }

  function exportPDF() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    doc.setFillColor(185, 28, 43);
    doc.rect(0, 0, 210, 18, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("IELTS LMS — Super Admin Accounts", 14, 12);

    autoTable(doc, {
      startY: 24,
      head: [["#", "Name", "Email", "Status", "Created"]],
      body: filteredAccounts.map((acc, i) => [
        i + 1,
        `${acc.first_name} ${acc.last_name}`,
        acc.email,
        acc.is_active ? "Active" : "Inactive",
        new Date(acc.created_at).toLocaleDateString("en-GB"),
      ]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
    });

    doc.save(`admin-accounts-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  function exportExcel() {
    const wsData = [
      ["#", "First Name", "Last Name", "Email", "Status", "Force Password Reset", "Created At"],
      ...filteredAccounts.map((acc, i) => [
        i + 1,
        acc.first_name,
        acc.last_name,
        acc.email,
        acc.is_active ? "Active" : "Inactive",
        acc.force_password_reset ? "Yes" : "No",
        new Date(acc.created_at).toLocaleDateString("en-GB"),
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [{ wch: 5 }, { wch: 18 }, { wch: 18 }, { wch: 28 }, { wch: 12 }, { wch: 20 }, { wch: 16 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Admin Accounts");
    XLSX.writeFile(wb, `admin-accounts-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Super Admin Accounts</h1>
          <p className="page-subtitle">Manage system administrators with global portal access.</p>
        </div>
        <Link to="/super-admin/accounts/new" className="button-link">
          + New Account
        </Link>
      </div>

      <div className="filter-bar institutes-filter-bar">
        <div className="search-input-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="search-icon">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search admin name or email..."
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
            { value: "", label: "All statuses" },
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
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
          Showing <strong>{filteredAccounts.length}</strong> {filteredAccounts.length === 1 ? "entry" : "entries"}
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table sleek-accounts-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Created</th>
                <th className="table-actions-heading">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.length === 0 && (
                <tr><td colSpan={5} className="empty-cell">No admin accounts found.</td></tr>
              )}
              {filteredAccounts.map((account) => (
                <tr key={account.id}>
                  <td>
                    <div className="table-item-cell">
                      <div className="table-avatar-tile">
                        {account.first_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <strong className="table-item-title" style={{ fontSize: 13.5 }}>
                          {account.first_name} {account.last_name}
                        </strong>
                        <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                          {currentUser?.id === account.id && <span className="badge badge-gray" style={{ fontSize: 10 }}>You</span>}
                          {account.force_password_reset && (
                            <span className="badge badge-amber" style={{ fontSize: 10 }}>Reset Required</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>{account.email}</td>
                  <td>
                    <span className={`badge ${account.is_active ? "badge-green" : "badge-gray"}`}>
                      {account.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>{new Date(account.created_at).toLocaleDateString("en-GB")}</td>
                  <td className="table-actions institute-row-actions">
                    <ToggleSwitch
                      checked={account.is_active}
                      onChange={() => handleToggleActive(account)}
                      tooltip={account.is_active ? "Deactivate Account" : "Reactivate Account"}
                    />
                    <Link className="action-btn-icon action-edit" to={`/super-admin/accounts/${account.id}`} data-tooltip="Edit Account">
                      <Icon name="edit" />
                    </Link>
                    <button
                      type="button"
                      className="action-btn-icon action-branding"
                      onClick={() => handleForceReset(account)}
                      data-tooltip={account.force_password_reset ? "Clear Password Reset" : "Require Password Reset"}
                    >
                      <Icon name="lock" />
                    </button>
                    <button
                      type="button"
                      className="action-btn-icon danger action-delete"
                      onClick={() => setDeletingAccount(account)}
                      data-tooltip="Delete Account"
                    >
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
        isOpen={Boolean(deletingAccount)}
        title="Delete Admin Account"
        message={deletingAccount ? `Are you sure you want to delete account "${deletingAccount.email}"? This action cannot be undone.` : ""}
        confirmText="Delete Account"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingAccount(null)}
      />
    </div>
  );
}
