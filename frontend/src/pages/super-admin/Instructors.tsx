import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import type { InstructorAccount, InstructorPasswordReset } from "../../api/types";
import { confirmDelete } from "../../components/confirmDialog";
import { ConfirmModal } from "../../components/ConfirmModal";
import { Icon } from "../../components/icons";
import { SearchableSelect } from "../../components/SearchableSelect";
import { ToggleSwitch } from "../../components/ToggleSwitch";
import { usePageTitleStore } from "../../store/pageTitleStore";

interface PasswordNotice {
  email: string;
  temporary_password: string;
}

function extractTemporaryPassword(data: InstructorPasswordReset): string {
  const response = data as InstructorPasswordReset & {
    temp_password?: string;
    temporaryPassword?: string;
  };
  return response.temporary_password || response.temp_password || response.temporaryPassword || "";
}

export function Instructors() {
  const [instructors, setInstructors] = useState<InstructorAccount[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<PasswordNotice | null>(null);

  const [deletingInstructor, setDeletingInstructor] = useState<InstructorAccount | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const setItemCount = usePageTitleStore((state) => state.setItemCount);

  async function loadInstructors() {
    setLoading(true);
    try {
      const params: Record<string, string | boolean> = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== "all") params.active = statusFilter === "active";
      const { data } = await apiClient.get<InstructorAccount[]>("/super-admin/instructors", { params });
      setInstructors(data);
      setError(null);
    } catch {
      setError("Failed to load instructors.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInstructors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    setItemCount(instructors.length);
    return () => setItemCount(null);
  }, [instructors.length, setItemCount]);

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    loadInstructors();
  }

  async function toggleActive(instructor: InstructorAccount) {
    const action = instructor.is_active ? "deactivate" : "reactivate";
    if (instructor.is_active && !window.confirm(`Deactivate ${instructor.email}? Their active sessions will be revoked.`)) return;
    setError(null);
    setInstructors((current) =>
      current.map((item) => item.id === instructor.id ? { ...item, is_active: !instructor.is_active } : item)
    );
    try {
      await apiClient.post(`/super-admin/instructors/${instructor.id}/${action}`);
    } catch (err: unknown) {
      setInstructors((current) =>
        current.map((item) => item.id === instructor.id ? { ...item, is_active: instructor.is_active } : item)
      );
      setError(extractErrorMessage(err, `Failed to ${action} instructor.`));
    }
  }

  async function resetPassword(instructor: InstructorAccount) {
    if (!window.confirm(`Reset the password for ${instructor.email}? Their active sessions will be revoked.`)) return;
    setError(null);
    try {
      const { data } = await apiClient.post<InstructorPasswordReset>(`/super-admin/instructors/${instructor.id}/reset-password`);
      const temporaryPassword = extractTemporaryPassword(data);
      if (!temporaryPassword) {
        setPasswordNotice(null);
        setError("Temporary password was not returned by the server. Restart the backend and try Reset Password again.");
        return;
      }
      setPasswordNotice({ email: instructor.email, temporary_password: temporaryPassword });
      await loadInstructors();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to reset password."));
    }
  }

  async function copyTemporaryPassword() {
    if (!passwordNotice) return;
    if (!passwordNotice.temporary_password) {
      setError("No temporary password is available to copy. Try Reset Password again after restarting the backend.");
      return;
    }
    await navigator.clipboard.writeText(passwordNotice.temporary_password);
  }

  async function handleConfirmDelete() {
    if (!deletingInstructor) return;
    setError(null);
    setDeleteLoading(true);
    try {
      await apiClient.delete(`/super-admin/instructors/${deletingInstructor.id}`);
      setDeletingInstructor(null);
      await loadInstructors();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to delete instructor."));
    } finally {
      setDeleteLoading(false);
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((current) =>
      current.size === instructors.length ? new Set() : new Set(instructors.map((instructor) => instructor.id))
    );
  }

  async function bulkSetActive(active: boolean) {
    const targets = instructors.filter((instructor) => selectedIds.has(instructor.id) && instructor.is_active !== active);
    if (!targets.length) return;
    if (!active && !window.confirm(`Deactivate ${targets.length} instructor${targets.length === 1 ? "" : "s"}? Their active sessions will be revoked.`)) return;
    setBulkBusy(true);
    setError(null);
    const results = await Promise.allSettled(
      targets.map((instructor) => apiClient.post(`/super-admin/instructors/${instructor.id}/${active ? "reactivate" : "deactivate"}`))
    );
    const failed = results.filter((result) => result.status === "rejected").length;
    if (failed) setError(`Failed to ${active ? "activate" : "deactivate"} ${failed} of ${targets.length} instructors.`);
    setSelectedIds(new Set());
    setBulkBusy(false);
    await loadInstructors();
  }

  async function bulkDelete() {
    const targets = instructors.filter((instructor) => selectedIds.has(instructor.id));
    if (!targets.length) return;
    if (!await confirmDelete(`Are you sure you want to delete ${targets.length} instructor${targets.length === 1 ? "" : "s"}? This action cannot be undone.`, "Delete Instructors")) return;
    setBulkBusy(true);
    setError(null);
    const results = await Promise.allSettled(targets.map((instructor) => apiClient.delete(`/super-admin/instructors/${instructor.id}`)));
    const failed = results.filter((result) => result.status === "rejected").length;
    if (failed) setError(`Failed to delete ${failed} of ${targets.length} instructors.`);
    setSelectedIds(new Set());
    setBulkBusy(false);
    await loadInstructors();
  }

  function exportPDF() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    doc.setFillColor(185, 28, 43);
    doc.rect(0, 0, 210, 18, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("IELTS LMS — SA Instructors Report", 14, 12);

    autoTable(doc, {
      startY: 24,
      head: [["#", "Instructor Name", "Title & Email", "Status", "Created"]],
      body: instructors.map((ins, i) => [
        i + 1,
        `${ins.first_name} ${ins.last_name}`,
        `${ins.title ? `${ins.title} · ` : ""}${ins.email}`,
        ins.is_active ? "Active" : "Inactive",
        new Date(ins.created_at).toLocaleDateString("en-GB"),
      ]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
    });

    doc.save(`sa-instructors-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  function exportExcel() {
    const wsData = [
      ["#", "First Name", "Last Name", "Title", "Email", "Status", "Force Reset", "Created At"],
      ...instructors.map((ins, i) => [
        i + 1,
        ins.first_name,
        ins.last_name,
        ins.title ?? "",
        ins.email,
        ins.is_active ? "Active" : "Inactive",
        ins.force_password_reset ? "Yes" : "No",
        new Date(ins.created_at).toLocaleDateString("en-GB"),
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [{ wch: 5 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 28 }, { wch: 12 }, { wch: 14 }, { wch: 16 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SA Instructors");
    XLSX.writeFile(wb, `sa-instructors-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div>
      {passwordNotice && (
        <div className="delivery-notice success" role="status" style={{ marginBottom: 20 }}>
          <span>Temporary password for <strong>{passwordNotice.email}</strong>: <code>{passwordNotice.temporary_password}</code></span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="secondary-button" onClick={copyTemporaryPassword}>Copy</button>
            <button className="secondary-button" onClick={() => setPasswordNotice(null)}>Dismiss</button>
          </div>
        </div>
      )}

      <form className="filter-bar institutes-filter-bar" onSubmit={handleSearch}>
        <div className="search-input-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="search-icon">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            aria-label="Search instructors"
            placeholder="Search name, email, or title..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search && (
            <button type="button" className="clear-search-btn" onClick={() => { setSearch(""); loadInstructors(); }} aria-label="Clear search">
              ✕
            </button>
          )}
        </div>

        <SearchableSelect
          options={[
            { value: "all", label: "All statuses" },
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
            <Icon name="filePdf" />
          </button>
          <button type="button" className="export-btn export-excel" onClick={exportExcel} data-tooltip="Export Excel">
            <Icon name="spreadsheet" />
          </button>
        </div>

        <Link to="/super-admin/instructors/new" className="button-link">+ New Instructor</Link>

        <div className="filter-result-count">
          Showing <strong>{instructors.length}</strong> {instructors.length === 1 ? "entry" : "entries"}
        </div>
      </form>

      {error && <p className="error-text">{error}</p>}

      {selectedIds.size > 0 && (
        <div className="bulk-actions-bar">
          <span><strong>{selectedIds.size}</strong> selected</span>
          <div className="bulk-actions-buttons">
            <button type="button" className="secondary-button" disabled={bulkBusy} onClick={() => bulkSetActive(true)}>Activate</button>
            <button type="button" className="secondary-button" disabled={bulkBusy} onClick={() => bulkSetActive(false)}>Deactivate</button>
            <button type="button" className="danger" disabled={bulkBusy} onClick={bulkDelete}>Delete</button>
            <button type="button" className="secondary-button" disabled={bulkBusy} onClick={() => setSelectedIds(new Set())}>Clear</button>
          </div>
        </div>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table sleek-institutes-table">
            <thead>
              <tr>
                <th className="table-select-heading">
                  <input
                    type="checkbox"
                    aria-label="Select all instructors"
                    checked={instructors.length > 0 && selectedIds.size === instructors.length}
                    ref={(el) => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < instructors.length; }}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>Instructor</th>
                <th>Status</th>
                <th>Created</th>
                <th className="table-actions-heading" style={{ textAlign: "center", width: 140, minWidth: 140 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {instructors.length === 0 ? (
                <tr><td colSpan={5} className="empty-cell">No instructors match these filters.</td></tr>
              ) : (
                instructors.map((instructor) => (
                  <tr key={instructor.id}>
                    <td className="table-select-cell">
                      <input
                        type="checkbox"
                        aria-label={`Select ${instructor.first_name} ${instructor.last_name}`}
                        checked={selectedIds.has(instructor.id)}
                        onChange={() => toggleSelect(instructor.id)}
                      />
                    </td>
                    <td>
                      <div className="table-item-cell">
                        <div className="table-avatar-tile">
                          {instructor.first_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="table-item-details">
                          <span className="table-item-title" style={{ fontSize: 13.5 }}>
                            {instructor.first_name} {instructor.last_name}
                          </span>
                          <span className="table-item-subtitle" style={{ fontSize: 12, color: "var(--slate-500)" }}>
                            {instructor.title ? `${instructor.title} · ` : ""}{instructor.email}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span className={`badge ${instructor.is_active ? "badge-green" : "badge-inactive"}`}>
                          {instructor.is_active ? "Active" : "Inactive"}
                        </span>
                        {instructor.force_password_reset && <span className="badge badge-amber">reset required</span>}
                      </div>
                    </td>
                    <td>{new Date(instructor.created_at).toLocaleDateString("en-GB")}</td>
                    <td className="table-actions institute-row-actions">
                      <ToggleSwitch
                        checked={instructor.is_active}
                        onChange={() => toggleActive(instructor)}
                        tooltip={instructor.is_active ? "Deactivate Instructor" : "Reactivate Instructor"}
                      />
                      <Link className="action-btn-icon action-edit" to={`/super-admin/instructors/${instructor.id}`} data-tooltip="Edit Instructor">
                        <Icon name="edit" />
                      </Link>
                      <button
                        type="button"
                        className="action-btn-icon action-branding"
                        onClick={() => resetPassword(instructor)}
                        data-tooltip="Reset Password"
                      >
                        <Icon name="lock" />
                      </button>
                      <button
                        type="button"
                        className="action-btn-icon danger action-delete"
                        onClick={() => setDeletingInstructor(instructor)}
                        data-tooltip="Delete Instructor"
                      >
                        <Icon name="trash" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deletingInstructor)}
        title="Delete Instructor"
        message={deletingInstructor ? `Are you sure you want to delete instructor "${deletingInstructor.email}"? This action cannot be undone.` : ""}
        confirmText="Delete Instructor"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingInstructor(null)}
      />
    </div>
  );
}
