import { Link } from "react-router-dom";
import { Icon } from "@/components/icons";
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
    <div className="table-wrap">
      <table className="data-table sleek-institutes-table">
        <thead>
          <tr>
            <th>{t.invoice}</th>
            <th>{t.source}</th>
            <th>{t.instituteOrPlan}</th>
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
              <td colSpan={7} className="empty-cell">
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
                <strong style={{ fontSize: 13.5 }}>
                  {row.currency || "INR"} {Number(row.amount_paid).toLocaleString("en-IN")}
                </strong>
                {Number(row.due_amount) > 0 && (
                  <div className="table-item-subtitle" style={{ fontSize: 11.5, color: "var(--sa-sidebar-red)", fontWeight: 600 }}>
                    {t.duePrefix} {row.currency || "INR"} {Number(row.due_amount).toLocaleString("en-IN")}
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
    </div>
  );
}
