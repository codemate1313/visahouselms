import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
import { usePageTitleStore } from "../../store/pageTitleStore";

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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<PlanRow | null>(null);
  const [viewingPlan, setViewingPlan] = useState<PlanRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const setItemCount = usePageTitleStore((state) => state.setItemCount);

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

  const query = search.trim().toLowerCase();
  const filteredPlans = plans.filter((plan) => {
    const matchesSearch =
      !query ||
      plan.name.toLowerCase().includes(query) ||
      Boolean(plan.description?.toLowerCase().includes(query));

    const statusKey = !plan.is_active ? "inactive" : plan.is_published ? "active" : "draft";
    const matchesStatus = !statusFilter || statusKey === statusFilter;

    return matchesSearch && matchesStatus;
  });

  useEffect(() => {
    setItemCount(filteredPlans.length);
    return () => setItemCount(null);
  }, [filteredPlans.length, setItemCount]);

  async function toggleActive(plan: PlanRow) {
    setError(null);
    const action = plan.is_active ? "deactivate" : "reactivate";
    setPlans((current) =>
      current.map((item) => item.id === plan.id ? { ...item, is_active: !plan.is_active } : item)
    );
    try {
      await apiClient.post(`/super-admin/plans/${plan.id}/${action}`);
    } catch (err: unknown) {
      setPlans((current) =>
        current.map((item) => item.id === plan.id ? { ...item, is_active: plan.is_active } : item)
      );
      setError(extractErrorMessage(err, `Failed to ${action} plan.`));
    }
  }

  async function handleConfirmDelete() {
    if (!deletingPlan) return;
    setError(null);
    setDeleteLoading(true);
    try {
      await apiClient.delete(`/super-admin/plans/${deletingPlan.id}`);
      setDeletingPlan(null);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to delete plan."));
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
    doc.text("IELTS LMS — Subscription Plans Report", 14, 13);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleString()}`, 220, 13);

    autoTable(doc, {
      startY: 26,
      head: [["#", "Plan Name", "Price", "Duration", "Limits (Students/Staff/Tests)", "Grace", "Courses", "Subs", "Status"]],
      body: filteredPlans.map((plan, i) => [
        i + 1,
        plan.name,
        `${plan.currency || "INR"} ${plan.price}`,
        `${plan.duration_days} days`,
        `${plan.student_limit} / ${plan.staff_limit} / ${plan.test_limit}`,
        `${plan.grace_days} days`,
        plan.module_count,
        plan.subscription_count,
        !plan.is_active ? "Inactive" : plan.is_published ? "Active" : "Draft",
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
        1: { cellWidth: 50 },
      },
    });

    doc.save(`subscription-plans-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  function exportExcel() {
    const wsData = [
      ["#", "Plan Name", "Description", "Price", "Currency", "Duration (Days)", "Student Limit", "Staff Limit", "Test Limit", "Grace Days", "Courses Count", "Active Subscriptions", "Status"],
      ...filteredPlans.map((plan, i) => [
        i + 1,
        plan.name,
        plan.description ?? "",
        plan.price,
        plan.currency || "INR",
        plan.duration_days,
        plan.student_limit,
        plan.staff_limit,
        plan.test_limit,
        plan.grace_days,
        plan.module_count,
        plan.subscription_count,
        !plan.is_active ? "Inactive" : plan.is_published ? "Active" : "Draft",
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [
      { wch: 5 }, { wch: 28 }, { wch: 36 }, { wch: 12 },
      { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 20 }, { wch: 14 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Subscription Plans");
    XLSX.writeFile(wb, `subscription-plans-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div>
      {error && <p className="error-text">{error}</p>}

      <div className="filter-bar institutes-filter-bar">
        <div className="search-input-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="search-icon">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search plan name or description..."
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
            { value: "draft", label: "Draft" },
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

        <Link to="/super-admin/plans/new" className="button-link">+ New Plan</Link>

        <div className="filter-result-count">
          Showing <strong>{filteredPlans.length}</strong> {filteredPlans.length === 1 ? "entry" : "entries"}
        </div>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table sleek-plans-table">
            <thead>
              <tr>
                <th style={{ width: "32%" }}>Plan Name</th>
                <th style={{ width: "22%" }}>Price & Duration</th>
                <th style={{ width: "20%" }}>Limits (std / stf / tst)</th>
                <th style={{ width: "12%" }}>Status</th>
                <th className="table-actions-heading" style={{ textAlign: "right", paddingRight: 20 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlans.length === 0 && (
                <tr><td colSpan={5} className="empty-cell">No subscription plans found.</td></tr>
              )}
              {filteredPlans.map((plan) => (
                <tr key={plan.id}>
                  <td>
                    <div className="table-item-details">
                      <span className="table-item-title" style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{plan.name}</span>
                      <span className="table-item-subtitle" style={{ fontSize: 12, color: "#64748b" }}>
                        Target: {plan.audience.replace("_", " ")}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="table-item-details">
                      <strong style={{ fontSize: 14, color: "#0f172a", whiteSpace: "nowrap" }}>
                        {plan.currency || "INR"} {Number(plan.price).toLocaleString("en-IN")}
                      </strong>
                      <span style={{ fontSize: 12, color: "#64748b" }}>
                        {plan.duration_days} days
                      </span>
                    </div>
                  </td>
                  <td>
                    <span
                      className="plan-limits-pill"
                      title={`${plan.student_limit} Students / ${plan.staff_limit} Staff / ${plan.test_limit} Tests`}
                    >
                      {plan.student_limit} / {plan.staff_limit} / {plan.test_limit}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${!plan.is_active ? "badge-inactive" : plan.is_published ? "badge-green" : "badge-amber"}`}>
                      {!plan.is_active ? "Inactive" : plan.is_published ? "Active" : "Draft"}
                    </span>
                  </td>
                  <td className="table-actions institute-row-actions">
                    <ToggleSwitch
                      checked={plan.is_active}
                      onChange={() => toggleActive(plan)}
                      tooltip={plan.is_active ? "Deactivate Plan" : "Reactivate Plan"}
                    />
                    <button
                      type="button"
                      className="action-btn-icon action-view"
                      onClick={() => setViewingPlan(plan)}
                      data-tooltip="View Full Plan Details"
                    >
                      <Icon name="eye" />
                    </button>
                    <Link className="action-btn-icon action-edit" to={`/super-admin/plans/${plan.id}`} data-tooltip="Edit Plan">
                      <Icon name="edit" />
                    </Link>
                    <button
                      type="button"
                      className="action-btn-icon danger action-delete"
                      onClick={() => setDeletingPlan(plan)}
                      data-tooltip="Delete Plan"
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

      {/* Ultra-Premium Plan Details Modal Dialog */}
      {viewingPlan &&
        createPortal(
          <div className="plan-dialog-backdrop" onClick={() => setViewingPlan(null)}>
            <div className="plan-dialog-card" onClick={(e) => e.stopPropagation()}>
              <div className="plan-dialog-header">
                <div className="plan-dialog-header-left">
                  <div className="plan-dialog-icon">
                    <Icon name="plan" />
                  </div>
                  <div>
                    <div className="plan-dialog-title-row">
                      <h2 className="plan-dialog-title">{viewingPlan.name}</h2>
                      <span className={`badge ${!viewingPlan.is_active ? "badge-inactive" : viewingPlan.is_published ? "badge-green" : "badge-amber"}`}>
                        {!viewingPlan.is_active ? "Inactive" : viewingPlan.is_published ? "Active" : "Draft"}
                      </span>
                    </div>
                    <span className="plan-dialog-price">
                      {viewingPlan.currency || "INR"} {Number(viewingPlan.price).toLocaleString("en-IN")}
                      <small> / {viewingPlan.duration_days} Days Billing Cycle</small>
                    </span>
                  </div>
                </div>
                <button type="button" className="plan-dialog-close" onClick={() => setViewingPlan(null)} title="Close Modal">
                  <Icon name="x" />
                </button>
              </div>

              <div className="plan-dialog-body">
                {viewingPlan.description && (
                  <div className="plan-dialog-section">
                    <label className="plan-dialog-label">Plan Overview & Description</label>
                    <p className="plan-dialog-desc">{viewingPlan.description}</p>
                  </div>
                )}

                <div className="plan-dialog-grid">
                  <div className="plan-metric-card metric-students">
                    <div className="plan-metric-icon">
                      <Icon name="user" />
                    </div>
                    <div className="plan-metric-info">
                      <span className="plan-metric-label">Student Limit</span>
                      <strong className="plan-metric-val">{viewingPlan.student_limit.toLocaleString()} Students</strong>
                    </div>
                  </div>

                  <div className="plan-metric-card metric-staff">
                    <div className="plan-metric-icon">
                      <Icon name="admin" />
                    </div>
                    <div className="plan-metric-info">
                      <span className="plan-metric-label">Staff Limit</span>
                      <strong className="plan-metric-val">{viewingPlan.staff_limit.toLocaleString()} Staff Members</strong>
                    </div>
                  </div>

                  <div className="plan-metric-card metric-tests">
                    <div className="plan-metric-icon">
                      <Icon name="session" />
                    </div>
                    <div className="plan-metric-info">
                      <span className="plan-metric-label">Test Limit</span>
                      <strong className="plan-metric-val">{viewingPlan.test_limit.toLocaleString()} Mock Tests</strong>
                    </div>
                  </div>

                  <div className="plan-metric-card metric-grace">
                    <div className="plan-metric-icon">
                      <Icon name="due" />
                    </div>
                    <div className="plan-metric-info">
                      <span className="plan-metric-label">Grace Period</span>
                      <strong className="plan-metric-val">{viewingPlan.grace_days} Days Extension</strong>
                    </div>
                  </div>

                  <div className="plan-metric-card metric-courses">
                    <div className="plan-metric-icon">
                      <Icon name="courses" />
                    </div>
                    <div className="plan-metric-info">
                      <span className="plan-metric-label">Assigned Courses</span>
                      <strong className="plan-metric-val">{viewingPlan.module_count} Included Courses</strong>
                    </div>
                  </div>

                  <div className="plan-metric-card metric-subs">
                    <div className="plan-metric-icon">
                      <Icon name="subscription" />
                    </div>
                    <div className="plan-metric-info">
                      <span className="plan-metric-label">Active Subscriptions</span>
                      <strong className="plan-metric-val">{viewingPlan.subscription_count} Active Subscribers</strong>
                    </div>
                  </div>
                </div>

                <div className="plan-dialog-meta">
                  <div>
                    <span style={{ color: "#64748b" }}>Target Audience: </span>
                    <strong style={{ textTransform: "capitalize", color: "#0f172a" }}>{viewingPlan.audience.replace("_", " ")}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>Publish Status: </span>
                    <strong style={{ color: "#0f172a" }}>{viewingPlan.is_published ? "Published" : "Draft"}</strong>
                  </div>
                </div>
              </div>

              <div className="plan-dialog-footer">
                <button type="button" className="secondary-button" onClick={() => setViewingPlan(null)}>
                  Close
                </button>
                <Link to={`/super-admin/plans/${viewingPlan.id}`} className="button-link" onClick={() => setViewingPlan(null)}>
                  Edit Plan
                </Link>
              </div>
            </div>
          </div>,
          document.body
        )}

      <ConfirmModal
        isOpen={Boolean(deletingPlan)}
        title="Delete Plan"
        message={deletingPlan ? `Are you sure you want to delete plan "${deletingPlan.name}"? This action cannot be undone.` : ""}
        confirmText="Delete Plan"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingPlan(null)}
      />
    </div>
  );
}
