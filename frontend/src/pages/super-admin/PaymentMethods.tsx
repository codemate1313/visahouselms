import { type FormEvent, useCallback, useEffect, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import { ConfirmModal } from "../../components/ConfirmModal";
import { Icon } from "../../components/icons";
import { SearchableSelect } from "../../components/SearchableSelect";
import { ToggleSwitch } from "../../components/ToggleSwitch";

interface MethodRow {
  id: number;
  name: string;
  is_active: boolean;
}

export function PaymentMethods() {
  const [methods, setMethods] = useState<MethodRow[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [deletingMethod, setDeletingMethod] = useState<MethodRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<MethodRow[]>("/super-admin/payment-methods");
      setMethods(data);
    } catch {
      setError("Failed to load payment methods.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const query = search.trim().toLowerCase();
  const filteredMethods = methods.filter((m) => {
    const matchesSearch = !query || m.name.toLowerCase().includes(query);
    const matchesStatus = !statusFilter || (statusFilter === "active" ? m.is_active : !m.is_active);
    return matchesSearch && matchesStatus;
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiClient.post("/super-admin/payment-methods", { name });
      setName("");
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to create payment method."));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(method: MethodRow) {
    setError(null);
    const action = method.is_active ? "deactivate" : "reactivate";
    setMethods((current) =>
      current.map((item) => item.id === method.id ? { ...item, is_active: !method.is_active } : item)
    );
    try {
      await apiClient.post(`/super-admin/payment-methods/${method.id}/${action}`);
    } catch (err: unknown) {
      setMethods((current) =>
        current.map((item) => item.id === method.id ? { ...item, is_active: method.is_active } : item)
      );
      setError(extractErrorMessage(err, `Failed to ${action} payment method.`));
    }
  }

  async function handleConfirmDelete() {
    if (!deletingMethod) return;
    setError(null);
    setDeleteLoading(true);
    try {
      await apiClient.delete(`/super-admin/payment-methods/${deletingMethod.id}`);
      setDeletingMethod(null);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to delete payment method."));
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
    doc.text("IELTS LMS — Payment Methods", 14, 12);

    autoTable(doc, {
      startY: 24,
      head: [["#", "Payment Method Name", "Status"]],
      body: filteredMethods.map((m, i) => [i + 1, m.name, m.is_active ? "Active" : "Inactive"]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
    });

    doc.save(`payment-methods-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  function exportExcel() {
    const wsData = [
      ["#", "Method Name", "Status"],
      ...filteredMethods.map((m, i) => [i + 1, m.name, m.is_active ? "Active" : "Inactive"]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [{ wch: 5 }, { wch: 28 }, { wch: 14 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payment Methods");
    XLSX.writeFile(wb, `payment-methods-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Payment Methods</h1>
          <p className="page-subtitle">Modes of payment offered when recording offline payments (Bank Transfer, UPI, Cash, etc.).</p>
        </div>
      </div>

      <form className="form-card wide onboarding-section-card" onSubmit={handleSubmit} style={{ marginBottom: 24, maxWidth: 500 }}>
        <h2>Add Payment Method</h2>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="name">Method name</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Crypto / UPI" required />
          </div>
          <button type="submit" className="primary-submit-btn" disabled={saving} style={{ height: 42, padding: "0 22px" }}>
            {saving ? "Adding..." : "Add Method"}
          </button>
        </div>
        {error && <p className="error-text" style={{ marginTop: 10 }}>{error}</p>}
      </form>

      <div className="filter-bar institutes-filter-bar">
        <div className="search-input-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="search-icon">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search method name..."
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
          Showing <strong>{filteredMethods.length}</strong> {filteredMethods.length === 1 ? "entry" : "entries"}
        </div>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table sleek-institutes-table">
            <thead>
              <tr>
                <th>Method Name</th>
                <th>Status</th>
                <th className="table-actions-heading" style={{ textAlign: "center", width: 100, minWidth: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMethods.length === 0 && (
                <tr><td colSpan={3} className="empty-cell">No payment methods found.</td></tr>
              )}
              {filteredMethods.map((method) => (
                <tr key={method.id}>
                  <td>
                    <strong style={{ fontSize: 14, color: "var(--slate-900)" }}>{method.name}</strong>
                  </td>
                  <td>
                    <span className={`badge ${method.is_active ? "badge-green" : "badge-gray"}`}>
                      {method.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="table-actions institute-row-actions" style={{ justifyContent: "center" }}>
                    <ToggleSwitch
                      checked={method.is_active}
                      onChange={() => toggleActive(method)}
                      tooltip={method.is_active ? "Deactivate Method" : "Reactivate Method"}
                    />
                    <button
                      className="action-btn-icon danger action-delete"
                      onClick={() => setDeletingMethod(method)}
                      data-tooltip="Delete Method"
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
        isOpen={Boolean(deletingMethod)}
        title="Delete Payment Method"
        message={deletingMethod ? `Are you sure you want to delete payment method "${deletingMethod.name}"?` : ""}
        confirmText="Delete Method"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingMethod(null)}
      />
    </div>
  );
}
