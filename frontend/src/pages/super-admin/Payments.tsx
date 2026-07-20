import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
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

  return (
    <div>
      <div className="page-header">
        <h1>Payments</h1>
        <button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ Record Payment"}
        </button>
      </div>

      {result && (
        <div className="banner" style={{ background: "#dcfce7", color: "#15803d", border: "1px solid #86efac" }}>
          Payment recorded — invoice <strong>{result.invoice_number}</strong>.{" "}
          <Link to={`/super-admin/payments/${result.id}/invoice`}>View invoice</Link>
        </div>
      )}

      {showForm && (
        <form className="form-card wide" onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
          <p className="hint" style={{ marginBottom: 12 }}>
            Records a manual/offline payment (bank transfer, cash, etc.) and immediately
            grants the subscription. Leave "Amount received" blank to record the full price;
            enter a smaller amount to record a partial/deposit payment — the balance will
            show as due and can be settled later.
          </p>
          <div className="form-grid">
            <div>
              <label htmlFor="institute">Institute</label>
              <select id="institute" value={instituteId} onChange={(e) => setInstituteId(e.target.value)} required>
                <option value="">Select institute...</option>
                {institutes.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="plan">Plan</label>
              <select id="plan" value={planId} onChange={(e) => setPlanId(e.target.value)} required>
                <option value="">Select plan...</option>
                {plans.filter((p) => p.is_active).map((p) => (
                  <option key={p.id} value={p.id}>{p.name} - {p.currency} {p.price}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="coupon">Coupon code (optional)</label>
              <input id="coupon" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="WELCOME10" />
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
              <select id="method" value={methodId} onChange={(e) => setMethodId(e.target.value)}>
                <option value="">Select mode...</option>
                {methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="reference">Reference note</label>
              <input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bank txn ID, cheque no..." />
            </div>
          </div>

          {error && <p className="error-text">{error}</p>}

          <div className="form-actions">
            <button type="submit" disabled={saving}>{saving ? "Recording..." : "Record Payment"}</button>
          </div>
        </form>
      )}

      <div className="filter-bar">
        <input placeholder="Search invoice, institute, plan..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={instituteFilter} onChange={(e) => setInstituteFilter(e.target.value)}>
          <option value="">All institutes</option>
          {institutes.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <span className="hint">to</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Source</th>
              <th>Institute / Plan</th>
              <th>Paid / Due</th>
              <th>Status</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="empty-cell">No payments match these filters.</td></tr>
            )}
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.invoice_number ?? "—"}</td>
                <td className="hint">{row.source.toUpperCase()}</td>
                <td>{row.institute_name ?? "—"} {row.plan_name && `/ ${row.plan_name}`}</td>
                <td>
                  {row.currency} {row.amount_paid}
                  {Number(row.due_amount) > 0 && (
                    <span className="due-text"> (due {row.currency} {row.due_amount})</span>
                  )}
                </td>
                <td>
                  <span className={`badge ${STATUS_BADGES[row.status] ?? "badge-gray"}`}>{row.status}</span>
                </td>
                <td>{new Date(row.created_at).toLocaleDateString()}</td>
                <td className="table-actions">
                  <Link to={`/super-admin/payments/${row.id}/invoice`}>Invoice</Link>
                  {Number(row.due_amount) > 0 && (row.status === "partial" || row.status === "pending") && (
                    <button onClick={() => openDueForm(row)}>Record due payment</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {dueFor && (
        <div className="modal-backdrop" onClick={() => setDueFor(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>Record due payment</h2>
            <p className="hint">
              {dueFor.institute_name} — {dueFor.invoice_number} — due {dueFor.currency} {dueFor.due_amount}
            </p>
            <form onSubmit={submitDuePayment}>
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
              <label htmlFor="due_method">Payment mode</label>
              <select id="due_method" value={dueMethodId} onChange={(e) => setDueMethodId(e.target.value)}>
                <option value="">Select mode...</option>
                {methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <label htmlFor="due_reference">Reference note</label>
              <input id="due_reference" value={dueReference} onChange={(e) => setDueReference(e.target.value)} />

              {dueError && <p className="error-text">{dueError}</p>}

              <div className="form-actions">
                <button type="submit" disabled={dueSaving}>{dueSaving ? "Recording..." : "Record Payment"}</button>
                <button type="button" onClick={() => setDueFor(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
