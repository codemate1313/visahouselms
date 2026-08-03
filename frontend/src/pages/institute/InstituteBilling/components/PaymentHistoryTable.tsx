import { formatCurrencyAmount } from "@/utils/currency";
import { instituteBillingStrings as strings } from "../InstituteBilling.strings";
import type { Payment } from "../types";
import { formatDate } from "@/utils/date";

interface PaymentHistoryTableProps {
  payments: Payment[];
}

export function PaymentHistoryTable({ payments }: PaymentHistoryTableProps) {
  const t = strings.history;
  return (
    <>
      <h2 className="section-title billing-history-title">{t.title}</h2>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t.invoice}</th>
              <th>{t.plan}</th>
              <th>{t.amount}</th>
              <th>{t.status}</th>
              <th>{t.date}</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-cell">{t.empty}</td>
              </tr>
            )}
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td>{payment.invoice_number ?? t.pendingInvoice}</td>
                <td>{payment.plan_name ?? "-"}</td>
                <td>{formatCurrencyAmount(payment.final_amount, payment.currency)}</td>
                <td>
                  <span className={`badge ${payment.status === "paid" ? "badge-green" : "badge-amber"}`}>{payment.status}</span>
                </td>
                <td>{formatDate(payment.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
