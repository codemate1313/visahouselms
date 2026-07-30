import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { usePageTitleStore } from "@/store/pageTitleStore";
import { confirmExport } from "@/utils/confirmExport";
import type { InstituteAllocation } from "@/pages/super-admin/InstituteForm/types";
import { paymentsStrings as strings } from "./Payments.strings";
import type { InstituteRow, MethodRow, PaymentRow } from "./types";
import { exportPaymentsExcel, exportPaymentsPDF } from "./exportHelpers";
import { RecordPaymentForm } from "./components/RecordPaymentForm";
import { PaymentsFilterBar } from "./components/PaymentsFilterBar";
import { PaymentsTable } from "./components/PaymentsTable";
import { DuePaymentModal } from "./components/DuePaymentModal";
import { Button, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";

export function Payments() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [institutes, setInstitutes] = useState<InstituteRow[]>([]);
  // The payment is recorded against the selected institute's own agreement, so
  // its provisions are looked up rather than chosen.
  const [allocation, setAllocation] = useState<InstituteAllocation | null>(null);
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
  const setItemCount = usePageTitleStore((state) => state.setItemCount);

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
      setError(strings.errors.load);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, instituteFilter, dateFrom, dateTo, search]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setItemCount(rows.length);
    return () => setItemCount(null);
  }, [rows.length, setItemCount]);

  useEffect(() => {
    apiClient.get("/super-admin/institutes").then(({ data }) => setInstitutes(data));
    apiClient.get<MethodRow[]>("/super-admin/payment-methods?active_only=true").then(({ data }) => setMethods(data));
  }, []);

  // Selecting an institute resolves the agreement the payment is booked
  // against, along with the provisions it covers.
  useEffect(() => {
    if (!instituteId) {
      setAllocation(null);
      setPlanId("");
      return;
    }
    let cancelled = false;
    apiClient
      .get(`/super-admin/institutes/${instituteId}`)
      .then(({ data }) => {
        if (cancelled) return;
        setAllocation(data.allocation ?? null);
        setPlanId(data.plan_id ? String(data.plan_id) : "");
      })
      .catch(() => {
        if (!cancelled) {
          setAllocation(null);
          setPlanId("");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [instituteId]);

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
      setError(extractErrorMessage(err, strings.errors.record));
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
      setDueError(extractErrorMessage(err, strings.errors.recordDue));
    } finally {
      setDueSaving(false);
    }
  }

  async function handleExportPdf() {
    if (!await confirmExport("pdf", "payments")) return;
    exportPaymentsPDF(rows);
  }

  async function handleExportExcel() {
    if (!await confirmExport("excel", "payments")) return;
    exportPaymentsExcel(rows);
  }

  return (
    <div>
      <PageHeader
        title={strings.title}
        subtitle={strings.subtitle}
        actions={
          <Button
            variant={showForm ? "secondary" : "primary"}
            leftIcon={showForm ? undefined : <Icon name="plus" />}
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? strings.cancel : strings.recordPayment}
          </Button>
        }
      />

      {result && (
        <div className="banner" style={{ background: "var(--shade-dcfce7)", color: "var(--green-700)", border: "1px solid var(--green-300)", borderRadius: 12, padding: "12px 18px", marginBottom: 20 }}>
          {strings.recordedBannerPrefix} <strong>{result.invoice_number}</strong>.{" "}
          <Link to={`/super-admin/payments/${result.id}/invoice`}>{strings.viewInvoice}</Link>
        </div>
      )}

      {showForm && (
        <RecordPaymentForm
          institutes={institutes}
          allocation={allocation}
          methods={methods}
          instituteId={instituteId}
          onInstituteIdChange={setInstituteId}
          couponCode={couponCode}
          onCouponCodeChange={setCouponCode}
          amountReceived={amountReceived}
          onAmountReceivedChange={setAmountReceived}
          methodId={methodId}
          onMethodIdChange={setMethodId}
          reference={reference}
          onReferenceChange={setReference}
          error={error}
          saving={saving}
          onSubmit={handleSubmit}
        />
      )}

      <PaymentsFilterBar
        search={search}
        onSearchChange={setSearch}
        institutes={institutes}
        instituteFilter={instituteFilter}
        onInstituteFilterChange={setInstituteFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        onExportPdf={handleExportPdf}
        onExportExcel={handleExportExcel}
        resultCount={rows.length}
      />

      {loading ? <p>{strings.loading}</p> : <PaymentsTable rows={rows} onOpenDueForm={openDueForm} />}

      {dueFor && (
        <DuePaymentModal
          dueFor={dueFor}
          methods={methods}
          dueAmount={dueAmount}
          onDueAmountChange={setDueAmount}
          dueMethodId={dueMethodId}
          onDueMethodIdChange={setDueMethodId}
          dueReference={dueReference}
          onDueReferenceChange={setDueReference}
          dueError={dueError}
          dueSaving={dueSaving}
          onSubmit={submitDuePayment}
          onClose={() => setDueFor(null)}
        />
      )}
    </div>
  );
}
