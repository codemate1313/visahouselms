import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import { Icon } from "../../components/icons";
import { SearchableSelect } from "../../components/SearchableSelect";
import type { PlanRow } from "./Plans";

interface InstituteRow {
  id: number;
  name: string;
}

interface MethodRow {
  id: number;
  name: string;
  is_active: boolean;
}

interface PaymentRow {
  id: number;
  source: string;
  institute_name: string | null;
  plan_name: string | null;
  final_amount: string;
  amount_paid: string;
  due_amount: string;
  currency: string;
  status: string;
  invoice_number: string | null;
  created_at: string;
}

const STATUS_BADGES: Record<string, string> = {
  paid: "badge-green",
  partial: "badge-amber",
  pending: "badge-amber",
  failed: "badge-red",
  refunded: "badge-gray",
};

export function Payments() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [institutes, setInstitutes] = useState<InstituteRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [methods, setMethods] = useState<MethodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [instituteId, setInstituteId] = useState("");
  const [planId, setPlanId] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [reference, setReference] = useState("");
  const [methodId, setMethodId] = useState("");
  const [amountReceived, setAmountReceived] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ invoice_number: string; id: number } | null>(null);

  const [statusFilter, setStatusFilter] = useState("");
  const [instituteFilter, setInstituteFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  const [dueFor, setDueFor] = useState<PaymentRow | null>(null);
  const [dueAmount, setDueAmount] = useState("");
  const [dueMethodId, setDueMethodId] = useState("");
  const [dueReference, setDueReference] = useState("");
  const [dueSaving, setDueSaving] = useState(false);
  const [dueError, setDueError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (instituteFilter) params.set("institute_id", instituteFilter);
      if (dateFrom) params.set("date_from", `${dateFrom}T00:00:00`);
      if (dateTo) params.set("date_to", `${dateTo}T23:59:59`);
      if (search) params.set("search", search);
      const { data } = await apiClient.get<PaymentRow[]>(`/super-admin/payments?${params}`);
      setRows(data);
    } catch {
      setError("Failed to load payments.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, instituteFilter, dateFrom, dateTo, search]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    apiClient.get("/super-admin/institutes").then(({ data }) => setInstitutes(data));
    apiClient.get<PlanRow[]>("/super-admin/plans").then(({ data }) => setPlans(data));
    apiClient.get<MethodRow[]>("/super-admin/payment-methods?active_only=true").then(({ data }) => setMethods(data));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);
    setSaving(true);
    try {
      const { data } = await apiClient.post("/super-admin/payments", {
        institute_id: Number(instituteId),
        plan_id: Number(planId),
        coupon_code: couponCode || null,
        gateway_reference: reference || null,
        payment_method_id: methodId ? Number(methodId) : null,
        amount_received: amountReceived ? Number(amountReceived) : null,
      });
      setResult({ invoice_number: data.invoice_number, id: data.id });
      setInstituteId("");
      setPlanId("");
      setCouponCode("");
      setReference("");
      setMethodId("");
      setAmountReceived("");
      setShowForm(false);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to record payment."));
    } finally {
      setSaving(false);
    }
  }

  function openDueForm(row: PaymentRow) {
    setDueFor(row);
    setDueAmount(row.due_amount);
    setDueMethodId("");
    setDueReference("");
    setDueError(null);
  }

  async function submitDuePayment(event: FormEvent) {
    event.preventDefault();
    if (!dueFor) return;
    setDueError(null);
    setDueSaving(true);
    try {
      await apiClient.post(`/super-admin/payments/${dueFor.id}/add-payment`, {
        amount: Number(dueAmount),
        payment_method_id: dueMethodId ? Number(dueMethodId) : null,
        reference: dueReference || null,
      });
      setDueFor(null);
      await load();
    } catch (err: unknown) {
      setDueError(extractErrorMessage(err, "Failed to record due payment."));
    } finally {
      setDueSaving(false);
    }
  }

  const selectedPlan = plans.find((p) => String(p.id) === planId);

  function exportPDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFillColor(185, 28, 43);
    doc.rect(0, 0, 297, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("IELTS LMS — Payment Transactions Report", 14, 13);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleString()}`, 220, 13);

    autoTable(doc, {
      startY: 26,
      head: [["#", "Invoice", "Source", "Institute / Plan", "Amount Paid", "Due Amount", "Status", "Date"]],
      body: rows.map((r, i) => [
        i + 1,
        r.invoice_number ?? "—",
        r.source.toUpperCase(),
        `${r.institute_name ?? "—"} ${r.plan_name ? `/ ${r.plan_name}` : ""}`,
        `${r.currency || "INR"} ${Number(r.amount_paid).toLocaleString("en-IN")}`,
        `${r.currency || "INR"} ${Number(r.due_amount).toLocaleString("en-IN")}`,
        r.status.toUpperCase(),
        new Date(r.created_at).toLocaleDateString("en-GB"),
      ]),
      styles: { fontSize: 9, cellPadding: 4, textColor: [15, 23, 42] },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    doc.save(`payments-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  function exportExcel() {
    const wsData = [
      ["#", "Invoice Number", "Source", "Institute Name", "Plan Name", "Currency", "Final Amount", "Amount Paid", "Due Amount", "Status", "Created At"],
      ...rows.map((r, i) => [
        i + 1,
        r.invoice_number ?? "",
        r.source,
        r.institute_name ?? "",
        r.plan_name ?? "",
        r.currency || "INR",
        r.final_amount,
        r.amount_paid,
        r.due_amount,
        r.status,
        new Date(r.created_at).toLocaleDateString("en-GB"),
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [{ wch: 5 }, { wch: 20 }, { wch: 12 }, { wch: 28 }, { wch: 24 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payments");
    XLSX.writeFile(wb, `payments-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Payments</h1>
          <p className="page-subtitle">Record and manage financial transactions, invoices, and partial due balances.</p>
        </div>
        <button
          type="button"
          className={showForm ? "secondary-link-btn" : "button-link"}
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? "Cancel" : "+ Record Payment"}
        </button>
      </div>

      {result && (
        <div className="banner" style={{ background: "#dcfce7", color: "#15803d", border: "1px solid #86efac", borderRadius: 12, padding: "12px 18px", marginBottom: 20 }}>
          Payment recorded — invoice <strong>{result.invoice_number}</strong>.{" "}
          <Link to={`/super-admin/payments/${result.id}/invoice`}>View invoice</Link>
        </div>
      )}

      {showForm && (
        <form className="form-card wide onboarding-section-card" onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
          <h2>Record Manual Payment</h2>
          <p className="hint" style={{ marginBottom: 16 }}>
            Records an offline payment (bank transfer, cash, etc.) and immediately grants the subscription.
          </p>

          <div className="form-grid">
            <div>
              <label htmlFor="institute">Institute</label>
              <SearchableSelect
                id="institute"
                options={[{ value: "", label: "Select institute..." }, ...institutes.map((i) => ({ value: i.id, label: i.name }))]}
                value={instituteId}
                onChange={(value) => setInstituteId(String(value))}
                searchPlaceholder="Search institutes..."
                className="form-dropdown-select"
              />
            </div>
            <div>
              <label htmlFor="plan">Plan</label>
              <SearchableSelect
                id="plan"
                options={[{ value: "", label: "Select plan..." }, ...plans.filter((p) => p.is_active).map((p) => ({ value: p.id, label: `${p.name} - ${p.currency || "INR"} ${p.price}` }))]}
                value={planId}
                onChange={(value) => setPlanId(String(value))}
                searchPlaceholder="Search plans..."
                className="form-dropdown-select"
              />
            </div>
            <div>
              <label htmlFor="coupon">Coupon code (optional)</label>
              <input id="coupon" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="e.g. WELCOME10" />
            </div>
            <div>
              <label htmlFor="amount_received">Amount received (optional)</label>
              <input
                id="amount_received"
                type="number"
                min="0"
                step="0.01"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                placeholder={selectedPlan ? `Full price: ${selectedPlan.price}` : "Full price"}
              />
            </div>
            <div>
              <label htmlFor="method">Payment mode</label>
              <SearchableSelect
                id="method"
                options={[{ value: "", label: "Select mode..." }, ...methods.map((m) => ({ value: m.id, label: m.name }))]}
                value={methodId}
                onChange={(value) => setMethodId(String(value))}
                searchPlaceholder="Search modes..."
                className="form-dropdown-select"
              />
            </div>
            <div>
              <label htmlFor="reference">Reference note</label>
              <input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bank txn ID, cheque no..." />
            </div>
          </div>

          {error && <p className="error-text" style={{ marginTop: 12 }}>{error}</p>}

          <div className="form-actions" style={{ marginTop: 20 }}>
            <button type="submit" className="primary-submit-btn" disabled={saving}>
              {saving ? "Recording..." : "Record Payment"}
            </button>
          </div>
        </form>
      )}

      <div className="filter-bar institutes-filter-bar">
        <div className="search-input-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="search-icon">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search invoice, institute, plan..."
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
            { value: "", label: "All institutes" },
            ...institutes.map((i) => ({ value: String(i.id), label: i.name })),
          ]}
          value={instituteFilter}
          onChange={(val) => setInstituteFilter(String(val))}
          placeholder="All institutes"
          searchPlaceholder="Search institute..."
          className="status-filter-select"
        />

        <SearchableSelect
          options={[
            { value: "", label: "All statuses" },
            { value: "paid", label: "Paid" },
            { value: "partial", label: "Partial" },
            { value: "pending", label: "Pending" },
            { value: "failed", label: "Failed" },
            { value: "refunded", label: "Refunded" },
          ]}
          value={statusFilter}
          onChange={(val) => setStatusFilter(String(val))}
          placeholder="All statuses"
          searchable={false}
          className="status-filter-select"
        />

        <div className="date-filter-wrap">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="date-input-field"
            aria-label="From Date"
          />
          <span className="date-sep-text">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="date-input-field"
            aria-label="To Date"
          />
        </div>

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
          Showing <strong>{rows.length}</strong> {rows.length === 1 ? "entry" : "entries"}
        </div>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table sleek-institutes-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Source</th>
                <th>Institute / Plan</th>
                <th>Paid / Due</th>
                <th>Status</th>
                <th>Date</th>
                <th className="table-actions-heading" style={{ textAlign: "center", width: 100, minWidth: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} className="empty-cell">No payments match these filters.</td></tr>
              )}
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong style={{ fontSize: 13.5, color: "#0f172a" }}>{row.invoice_number ?? "—"}</strong>
                  </td>
                  <td>
                    <span className="badge badge-gray" style={{ fontSize: 11 }}>{row.source.toUpperCase()}</span>
                  </td>
                  <td>
                    <div className="table-item-details">
                      <span className="table-item-title">{row.institute_name ?? "Direct Student"}</span>
                      {row.plan_name && (
                        <span className="table-item-subtitle" style={{ fontSize: 11.5, color: "#64748b" }}>
                          Plan: {row.plan_name}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <strong style={{ fontSize: 13.5 }}>
                      {row.currency || "INR"} {Number(row.amount_paid).toLocaleString("en-IN")}
                    </strong>
                    {Number(row.due_amount) > 0 && (
                      <div className="table-item-subtitle" style={{ fontSize: 11.5, color: "#b91c2b", fontWeight: 600 }}>
                        due {row.currency || "INR"} {Number(row.due_amount).toLocaleString("en-IN")}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGES[row.status] ?? "badge-gray"}`}>{row.status}</span>
                  </td>
                  <td>{new Date(row.created_at).toLocaleDateString("en-GB")}</td>
                  <td className="table-actions institute-row-actions" style={{ justifyContent: "center" }}>
                    <Link
                      className="action-btn-icon action-edit"
                      to={`/super-admin/payments/${row.id}/invoice`}
                      data-tooltip="View Invoice"
                    >
                      <Icon name="billings" />
                    </Link>
                    {Number(row.due_amount) > 0 && (row.status === "partial" || row.status === "pending") && (
                      <button
                        type="button"
                        className="action-btn-icon action-toggle"
                        onClick={() => openDueForm(row)}
                        data-tooltip="Record Due Payment"
                      >
                        <Icon name="overview" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dueFor && (
        <div className="modal-backdrop" onClick={() => setDueFor(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>Record Due Payment</h2>
            <p className="hint">
              {dueFor.institute_name} — {dueFor.invoice_number} — due {dueFor.currency || "INR"} {dueFor.due_amount}
            </p>
            <form onSubmit={submitDuePayment} style={{ marginTop: 16 }}>
              <label htmlFor="due_amount">Amount</label>
              <input
                id="due_amount"
                type="number"
                min="0.01"
                step="0.01"
                max={dueFor.due_amount}
                value={dueAmount}
                onChange={(e) => setDueAmount(e.target.value)}
                required
              />
              <label htmlFor="due_method" style={{ marginTop: 12 }}>Payment mode</label>
              <SearchableSelect
                id="due_method"
                options={[{ value: "", label: "Select mode..." }, ...methods.map((m) => ({ value: m.id, label: m.name }))]}
                value={dueMethodId}
                onChange={(value) => setDueMethodId(String(value))}
                searchPlaceholder="Search modes..."
                className="form-dropdown-select"
              />
              <label htmlFor="due_reference" style={{ marginTop: 12 }}>Reference note</label>
              <input id="due_reference" value={dueReference} onChange={(e) => setDueReference(e.target.value)} placeholder="Bank txn ID..." />

              {dueError && <p className="error-text" style={{ marginTop: 12 }}>{dueError}</p>}

              <div className="form-actions" style={{ marginTop: 20 }}>
                <button type="submit" className="primary-submit-btn" disabled={dueSaving}>
                  {dueSaving ? "Recording..." : "Record Payment"}
                </button>
                <button type="button" className="secondary-done-btn" onClick={() => setDueFor(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
