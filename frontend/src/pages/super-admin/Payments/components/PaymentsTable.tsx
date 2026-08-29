import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@/components/icons";
import { Badge, DataTableCard } from "@/components/ui";
import { formatCurrencyAmount } from "@/utils/currency";
import { paymentsStrings as strings } from "../Payments.strings";
import type { PaymentRow } from "../types";
import { formatDate } from "@/utils/date";
import type { BadgeTone } from "@/components/ui";
import "../Payments.css";

const STATUS_BADGES: Record<string, BadgeTone> = {
  paid: "green",
  partial: "amber",
  pending: "amber",
  failed: "red",
  refunded: "gray",
};

interface PaymentsTableProps {
  rows: PaymentRow[];
  onOpenDueForm: (row: PaymentRow) => void;
}

function parseGatewayReference(rawRef: string | null | undefined) {
  if (!rawRef || !rawRef.trim() || rawRef.trim() === "—") {
    return { orderId: null, paymentId: null, otherRef: null };
  }

  const str = rawRef.trim();

  // 1. Standard pattern: "Order: <order_id> | Payment: <payment_id>"
  const orderMatch = str.match(/Order:\s*([^\s|]+)/i);
  const paymentMatch = str.match(/Payment:\s*([^\s|]+)/i);

  let orderId = orderMatch ? orderMatch[1].trim() : null;
  let paymentId = paymentMatch ? paymentMatch[1].trim() : null;

  // 2. Direct match for order_ prefix if not matched by Order: prefix
  if (!orderId) {
    const directOrderMatch = str.match(/\b(order_[a-zA-Z0-9_-]+)\b/i);
    if (directOrderMatch) {
      orderId = directOrderMatch[1].trim();
    }
  }

  // 3. Direct match for pay_ prefix if not matched by Payment: prefix
  if (!paymentId) {
    const directPayMatch = str.match(/\b(pay_[a-zA-Z0-9_-]+)\b/i);
    if (directPayMatch) {
      paymentId = directPayMatch[1].trim();
    }
  }

  // 4. Custom/manual reference
  let otherRef: string | null = null;
  if (!orderId && !paymentId) {
    otherRef = str;
  }

  return { orderId, paymentId, otherRef };
}

export function PaymentsTable({ rows, onOpenDueForm }: PaymentsTableProps) {
  const t = strings.table;
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const today: PaymentRow[] = [];
  const yesterday: PaymentRow[] = [];
  const older: PaymentRow[] = [];

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

  rows.forEach((row) => {
    if (!row.created_at) {
      older.push(row);
      return;
    }
    const date = new Date(row.created_at).getTime();
    if (date >= todayStart) {
      today.push(row);
    } else if (date >= yesterdayStart) {
      yesterday.push(row);
    } else {
      older.push(row);
    }
  });

  const renderReferenceCell = (row: PaymentRow) => {
    const { orderId, paymentId, otherRef } = parseGatewayReference(row.gateway_reference);

    if (!orderId && !paymentId && !otherRef) {
      return <span style={{ color: "var(--text-muted)", fontSize: 12.5 }}>—</span>;
    }

    const gatewayName = (row.gateway || "razorpay").toLowerCase();

    return (
      <div className="payment-ref-cell">
        <div className="payment-ref-gateway-row">
          <span className={`payment-gateway-pill gateway-${gatewayName}`}>
            {gatewayName.toUpperCase()}
          </span>
        </div>

        {orderId && (
          <div className="payment-ref-item">
            <span className="payment-ref-label">Order ID</span>
            <div className="payment-ref-val-wrapper">
              <code className="payment-ref-code" title={orderId}>
                {orderId}
              </code>
              <button
                type="button"
                className={`payment-ref-copy-btn ${copiedKey === `order-${row.id}` ? "is-copied" : ""}`}
                title={copiedKey === `order-${row.id}` ? "Copied!" : "Copy Order ID"}
                aria-label="Copy Order ID"
                onClick={() => handleCopy(orderId, `order-${row.id}`)}
              >
                <Icon
                  name={copiedKey === `order-${row.id}` ? "check" : "clipboard"}
                  style={{ width: 12, height: 12 }}
                />
              </button>
            </div>
          </div>
        )}

        {paymentId && (
          <div className="payment-ref-item">
            <span className="payment-ref-label">
              {gatewayName === "razorpay" ? "Razorpay ID" : "Payment ID"}
            </span>
            <div className="payment-ref-val-wrapper">
              <code className="payment-ref-code" title={paymentId}>
                {paymentId}
              </code>
              <button
                type="button"
                className={`payment-ref-copy-btn ${copiedKey === `pay-${row.id}` ? "is-copied" : ""}`}
                title={copiedKey === `pay-${row.id}` ? "Copied!" : "Copy Payment ID"}
                aria-label="Copy Payment ID"
                onClick={() => handleCopy(paymentId, `pay-${row.id}`)}
              >
                <Icon
                  name={copiedKey === `pay-${row.id}` ? "check" : "clipboard"}
                  style={{ width: 12, height: 12 }}
                />
              </button>
            </div>
          </div>
        )}

        {otherRef && (
          <div className="payment-ref-item">
            <span className="payment-ref-label">Reference</span>
            <span className="payment-ref-other text-xs font-mono">{otherRef}</span>
          </div>
        )}
      </div>
    );
  };

  const renderRow = (row: PaymentRow) => (
    <tr key={row.id}>
      <td className="col-invoice">
        <strong style={{ fontSize: 13.5, color: "var(--text)" }}>{row.invoice_number ?? "—"}</strong>
      </td>
      <td className="col-source">
        <Badge tone="gray" style={{ fontSize: 11 }}>
          {row.source.toUpperCase()}
        </Badge>
      </td>
      <td className="col-plan">
        <div className="table-item-details">
          <span className="table-item-title">{row.institute_name ?? t.directStudent}</span>
          {row.plan_name && (
            <span className="table-item-subtitle" style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
              {t.planPrefix} {row.plan_name}
            </span>
          )}
        </div>
      </td>
      <td className="col-payment-ref">
        {renderReferenceCell(row)}
      </td>
      <td className="col-paid-due">
        <strong style={{ fontSize: 13.5 }}>
          {formatCurrencyAmount(row.amount_paid, row.currency)}
        </strong>
        {Number(row.due_amount) > 0 && (
          <div className="table-item-subtitle" style={{ fontSize: 11.5, color: "var(--sa-sidebar-red)", fontWeight: 600 }}>
            {t.duePrefix} {formatCurrencyAmount(row.due_amount, row.currency)}
          </div>
        )}
      </td>
      <td className="col-status">
        <Badge tone={STATUS_BADGES[row.status] ?? "gray"}>{row.status}</Badge>
      </td>
      <td className="col-date">{formatDate(row.created_at)}</td>
      <td className="col-actions text-center">
        <div className="payment-table-actions">
          <Link
            className="payment-action-btn btn-invoice"
            to={`/super-admin/payments/${row.id}/invoice`}
            data-tooltip={t.viewInvoiceTooltip}
            aria-label={t.viewInvoiceTooltip}
          >
            <Icon name="billings" />
          </Link>
          {Number(row.due_amount) > 0 && (row.status === "partial" || row.status === "pending") && (
            <button
              type="button"
              className="payment-action-btn btn-due"
              onClick={() => onOpenDueForm(row)}
              data-tooltip={t.recordDuePaymentTooltip}
              aria-label={t.recordDuePaymentTooltip}
            >
              <Icon name="overview" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );

  return (
    <DataTableCard>
      <table className="data-table payments-table">
        <thead>
          <tr>
            <th className="col-invoice">{t.invoice}</th>
            <th className="col-source">{t.source}</th>
            <th className="col-plan">{t.instituteOrPlan}</th>
            <th className="col-payment-ref">{t.reference}</th>
            <th className="col-paid-due">{t.paidOrDue}</th>
            <th className="col-status">{t.status}</th>
            <th className="col-date">{t.date}</th>
            <th className="col-actions table-actions-heading">{t.actions}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="empty-cell">
                {t.empty}
              </td>
            </tr>
          )}
          {today.length > 0 && (
            <>
              <tr className="table-group-header">
                <td colSpan={8}>Today</td>
              </tr>
              {today.map(renderRow)}
            </>
          )}
          {yesterday.length > 0 && (
            <>
              <tr className="table-group-header">
                <td colSpan={8}>Yesterday</td>
              </tr>
              {yesterday.map(renderRow)}
            </>
          )}
          {older.length > 0 && (
            <>
              <tr className="table-group-header">
                <td colSpan={8}>Older Payments</td>
              </tr>
              {older.map(renderRow)}
            </>
          )}
        </tbody>
      </table>
    </DataTableCard>
  );
}

