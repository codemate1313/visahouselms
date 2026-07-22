import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import { ConfirmModal } from "../../components/ConfirmModal";
import { Icon } from "../../components/icons";
import { SearchableSelect } from "../../components/SearchableSelect";
import { ToggleSwitch } from "../../components/ToggleSwitch";

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

  const [deletingCoupon, setDeletingCoupon] = useState<CouponRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
    setCoupons((current) =>
      current.map((item) => item.id === coupon.id ? { ...item, is_active: !coupon.is_active } : item)
    );
    try {
      await apiClient.post(`/super-admin/coupons/${coupon.id}/${action}`);
    } catch (err: unknown) {
      setCoupons((current) =>
        current.map((item) => item.id === coupon.id ? { ...item, is_active: coupon.is_active } : item)
      );
      setError(extractErrorMessage(err, `Failed to ${action} coupon.`));
    }
  }

  async function handleConfirmDelete() {
    if (!deletingCoupon) return;
    setError(null);
    setDeleteLoading(true);
    try {
      await apiClient.delete(`/super-admin/coupons/${deletingCoupon.id}`);
      setDeletingCoupon(null);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to delete coupon."));
    } finally {
      setDeleteLoading(false);
    }
  }

  function exportPDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFillColor(185, 28, 43);
    doc.rect(0, 0, 297, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("IELTS LMS — Discount Coupons Report", 14, 13);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleString()}`, 220, 13);

    autoTable(doc, {
      startY: 26,
      head: [["#", "Coupon Code", "Discount Value", "Scope", "Usage Count", "Valid Window", "Status"]],
      body: coupons.map((c, i) => [
        i + 1,
        c.code,
        c.discount_type === "percent" ? `${c.value}%` : `INR ${c.value}`,
        c.scope,
        `${c.usage_count}${c.usage_limit ? ` / ${c.usage_limit}` : ""}`,
        `${c.valid_from ? new Date(c.valid_from).toLocaleDateString("en-GB") : "—"} to ${c.valid_until ? new Date(c.valid_until).toLocaleDateString("en-GB") : "—"}`,
        c.is_active ? "Active" : "Inactive",
      ]),
      styles: { fontSize: 9, cellPadding: 4, textColor: [15, 23, 42] },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    doc.save(`coupons-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  function exportExcel() {
    const wsData = [
      ["#", "Coupon Code", "Discount Type", "Value", "Scope", "Usage Count", "Usage Limit", "Valid From", "Valid Until", "Status"],
      ...coupons.map((c, i) => [
        i + 1,
        c.code,
        c.discount_type,
        c.value,
        c.scope,
        c.usage_count,
        c.usage_limit ?? "Unlimited",
        c.valid_from ? new Date(c.valid_from).toLocaleDateString("en-GB") : "",
        c.valid_until ? new Date(c.valid_until).toLocaleDateString("en-GB") : "",
        c.is_active ? "Active" : "Inactive",
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [{ wch: 5 }, { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 14 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Coupons");
    XLSX.writeFile(wb, `coupons-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Coupons</h1>
          <p className="page-subtitle">Manage promotional discount codes for plans and courses.</p>
        </div>
        <Link to="/super-admin/coupons/new" className="button-link">+ New Coupon</Link>
      </div>

      <div className="filter-bar institutes-filter-bar">
        <div className="search-input-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="search-icon">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search coupon code..."
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
            { value: "", label: "All scopes" },
            { value: "all", label: "All plans" },
            { value: "plan", label: "Specific plan" },
            { value: "course", label: "Specific course" },
          ]}
          value={scopeFilter}
          onChange={(val) => setScopeFilter(String(val))}
          placeholder="All scopes"
          searchable={false}
          className="status-filter-select"
        />

        <SearchableSelect
          options={[
            { value: "", label: "Any status" },
            { value: "true", label: "Active" },
            { value: "false", label: "Inactive" },
          ]}
          value={activeFilter}
          onChange={(val) => setActiveFilter(String(val))}
          placeholder="Any status"
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
          Showing <strong>{coupons.length}</strong> {coupons.length === 1 ? "entry" : "entries"}
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table sleek-institutes-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Scope</th>
                <th>Usage</th>
                <th>Valid Window</th>
                <th>Status</th>
                <th className="table-actions-heading" style={{ textAlign: "center", width: 140, minWidth: 140 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.length === 0 && (
                <tr><td colSpan={7} className="empty-cell">No coupons match these filters.</td></tr>
              )}
              {coupons.map((coupon) => (
                <tr key={coupon.id}>
                  <td>
                    <strong style={{ fontSize: 14, color: "#0f172a", letterSpacing: "0.02em" }}>{coupon.code}</strong>
                  </td>
                  <td>
                    <strong style={{ fontSize: 13.5, color: "#b91c2b" }}>
                      {coupon.discount_type === "percent" ? `${coupon.value}%` : `INR ${coupon.value}`}
                    </strong>
                  </td>
                  <td>
                    <span className="badge badge-gray" style={{ textTransform: "uppercase", fontSize: 11 }}>
                      {coupon.scope}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>
                      {coupon.usage_count}{coupon.usage_limit ? ` / ${coupon.usage_limit}` : ""}
                    </span>
                  </td>
                  <td>
                    <span className="table-item-subtitle" style={{ fontSize: 12, color: "#64748b" }}>
                      {coupon.valid_from ? new Date(coupon.valid_from).toLocaleDateString("en-GB") : "—"}
                      {" – "}
                      {coupon.valid_until ? new Date(coupon.valid_until).toLocaleDateString("en-GB") : "—"}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${coupon.is_active ? "badge-green" : "badge-gray"}`}>
                      {coupon.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="table-actions institute-row-actions" style={{ justifyContent: "center" }}>
                    <ToggleSwitch
                      checked={coupon.is_active}
                      onChange={() => toggleActive(coupon)}
                      tooltip={coupon.is_active ? "Deactivate Coupon" : "Reactivate Coupon"}
                    />
                    <Link className="action-btn-icon action-edit" to={`/super-admin/coupons/${coupon.id}`} data-tooltip="Edit Coupon">
                      <Icon name="edit" />
                    </Link>
                    <button
                      className="action-btn-icon danger action-delete"
                      onClick={() => setDeletingCoupon(coupon)}
                      data-tooltip="Delete Coupon"
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
        isOpen={Boolean(deletingCoupon)}
        title="Delete Coupon"
        message={deletingCoupon ? `Are you sure you want to delete coupon "${deletingCoupon.code}"?` : ""}
        confirmText="Delete Coupon"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingCoupon(null)}
      />
    </div>
  );
}
