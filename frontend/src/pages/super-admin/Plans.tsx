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
  const [deleteLoading, setDeleteLoading] = useState(false);

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
      <div className="page-header">
        <h1>Subscription Plans</h1>
        <Link to="/super-admin/plans/new" className="button-link">+ New Plan</Link>
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
                <th style={{ width: "26%" }}>Plan Name</th>
                <th>Price</th>
                <th>Duration</th>
                <th>
                  LIMITS
                  <span style={{ display: "block", fontSize: 9.5, fontWeight: 500, color: "#94a3b8", textTransform: "lowercase", marginTop: 2 }}>
                    (std / stf / tst)
                  </span>
                </th>
                <th>Grace</th>
                <th>Courses</th>
                <th>Subs</th>
                <th>Status</th>
                <th className="table-actions-heading" style={{ textAlign: "center", width: 140, minWidth: 140 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlans.length === 0 && (
                <tr><td colSpan={9} className="empty-cell">No subscription plans found.</td></tr>
              )}
              {filteredPlans.map((plan) => (
                <tr key={plan.id}>
                  <td>
                    <div className="table-item-details">
                      <span className="table-item-title" style={{ fontSize: 14, fontWeight: 650 }}>{plan.name}</span>
                      {plan.description && (
                        <span className="table-item-subtitle" style={{ fontSize: 12, color: "#64748b" }}>
                          {plan.description}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <strong style={{ fontSize: 13.5, whiteSpace: "nowrap" }}>
                      {plan.currency || "INR"} {plan.price}
                    </strong>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{plan.duration_days} days</td>
                  <td>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#334155", whiteSpace: "nowrap" }} title={`${plan.student_limit} Students / ${plan.staff_limit} Staff / ${plan.test_limit} Tests`}>
                      {plan.student_limit} / {plan.staff_limit} / {plan.test_limit}
                    </span>
                  </td>
                  <td>{plan.grace_days} days</td>
                  <td>
                    <div className="table-item-details">
                      <span className="badge badge-gray" style={{ fontWeight: 600, width: "max-content" }}>
                        {plan.module_count} courses
                      </span>
                    </div>
                  </td>
                  <td>
                    <strong style={{ fontSize: 13.5 }}>{plan.subscription_count}</strong>
                  </td>
                  <td>
                    <span className={`badge ${!plan.is_active ? "badge-gray" : plan.is_published ? "badge-green" : "badge-amber"}`}>
                      {!plan.is_active ? "Inactive" : plan.is_published ? "Active" : "Draft"}
                    </span>
                  </td>
                  <td className="table-actions institute-row-actions" style={{ justifyContent: "center" }}>
                    <ToggleSwitch
                      checked={plan.is_active}
                      onChange={() => toggleActive(plan)}
                      tooltip={plan.is_active ? "Deactivate Plan" : "Reactivate Plan"}
                    />
                    <Link className="action-btn-icon action-edit" to={`/super-admin/plans/${plan.id}`} data-tooltip="Edit Plan">
                      <Icon name="edit" />
                    </Link>
                    <button
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
