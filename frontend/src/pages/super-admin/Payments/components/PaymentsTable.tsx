import { Link } from "react-router-dom";
import { Icon } from "@/components/icons";
import { DataTableCard } from "@/components/ui";
import { formatCurrencyAmount } from "@/utils/currency";
import { paymentsStrings as strings } from "../Payments.strings";
import type { PaymentRow } from "../types";

const STATUS_BADGES: Record<string, string> = {
  paid: "badge-green",
  partial: "badge-amber",
  pending: "badge-amber",
  failed: "badge-red",
  refunded: "badge-gray",
};

interface PaymentsTableProps {
  rows: PaymentRow[];
  onOpenDueForm: (row: PaymentRow) => void;
}

export function PaymentsTable({ rows, onOpenDueForm }: PaymentsTableProps) {
  const t = strings.table;
  return (
    <DataTableCard>
      <table className="data-table sleek-institutes-table">
        <thead>
          <tr>
            <th>{t.invoice}</th>
            <th>{t.source}</th>
            <th>{t.instituteOrPlan}</th>
            <th>{t.reference}</th>
            <th>{t.paidOrDue}</th>
            <th>{t.status}</th>
            <th>{t.date}</th>
            <th className="table-actions-heading" style={{ textAlign: "center", width: 100, minWidth: 100 }}>
              {t.actions}
            </th>
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
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <strong style={{ fontSize: 13.5, color: "var(--slate-900)" }}>{row.invoice_number ?? "—"}</strong>
              </td>
              <td>
                <span className="badge badge-gray" style={{ fontSize: 11 }}>
                  {row.source.toUpperCase()}
                </span>
              </td>
              <td>
                <div className="table-item-details">
                  <span className="table-item-title">{row.institute_name ?? t.directStudent}</span>
                  {row.plan_name && (
                    <span className="table-item-subtitle" style={{ fontSize: 11.5, color: "var(--slate-500)" }}>
                      {t.planPrefix} {row.plan_name}
                    </span>
                  )}
                </div>
              </td>
              <td>
                {row.gateway_reference ? (
                  <div style={{ wordBreak: "break-all", maxWidth: 180, fontSize: 12.5, color: "var(--slate-600)" }}>
                    <span style={{ fontSize: 10, textTransform: "uppercase", background: "var(--slate-100)", padding: "1px 5px", borderRadius: 4, marginRight: 5, color: "var(--slate-600)", fontWeight: 600 }}>
                      {row.gateway || "manual"}
                    </span>
                    {row.gateway_reference}
                  </div>
                ) : (
                  <span style={{ color: "var(--slate-400)", fontSize: 12.5 }}>—</span>
                )}
              </td>
              <td>
                <strong style={{ fontSize: 13.5 }}>
                  {formatCurrencyAmount(row.amount_paid, row.currency)}
                </strong>
                {Number(row.due_amount) > 0 && (
                  <div className="table-item-subtitle" style={{ fontSize: 11.5, color: "var(--sa-sidebar-red)", fontWeight: 600 }}>
                    {t.duePrefix} {formatCurrencyAmount(row.due_amount, row.currency)}
                  </div>
                )}
              </td>
              <td>
                <span className={`badge ${STATUS_BADGES[row.status] ?? "badge-gray"}`}>{row.status}</span>
              </td>
              <td>{new Date(row.created_at).toLocaleDateString("en-GB")}</td>
              <td className="table-actions institute-row-actions" style={{ justifyContent: "center" }}>
                <Link className="action-btn-icon action-edit" to={`/super-admin/payments/${row.id}/invoice`} data-tooltip={t.viewInvoiceTooltip}>
                  <Icon name="billings" />
                </Link>
                {Number(row.due_amount) > 0 && (row.status === "partial" || row.status === "pending") && (
                  <button type="button" className="action-btn-icon action-toggle" onClick={() => onOpenDueForm(row)} data-tooltip={t.recordDuePaymentTooltip}>
                    <Icon name="overview" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>

      </table>
    </DataTableCard>
  );
}
