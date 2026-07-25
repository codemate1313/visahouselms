import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { formatCurrencyAmount } from "@/utils/currency";
import { invoiceStrings as strings } from "./Invoice.strings";

interface PaymentDetail {
  id: number;
  source: string;
  institute_name: string | null;
  plan_name: string | null;
  amount: string;
  discount_amount: string;
  final_amount: string;
  amount_paid: string;
  due_amount: string;
  currency: string;
  coupon_code: string | null;
  payment_method_name: string | null;
  gateway: string;
  gateway_reference: string | null;
  status: string;
  invoice_number: string | null;
  created_at: string;
  paid_at: string | null;
}

export function Invoice() {
  const { id } = useParams();
  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get(`/super-admin/payments/${id}`)
      .then(({ data }) => setPayment(data))
      .catch(() => setError(strings.errors.load));
  }, [id]);

  if (error) return <p className="error-text">{error}</p>;
  if (!payment) return <p>{strings.loading}</p>;

  const t = strings.table;

  return (
    <div>
      <div className="page-header no-print">
        <h1>
          {strings.titlePrefix} {payment.invoice_number}
        </h1>
        <button onClick={() => window.print()}>{strings.print}</button>
      </div>

      <div className="invoice-card">
        <div className="invoice-header">
          <div>
            <h2>{strings.companyName}</h2>
            <p className="hint">{strings.receiptSubtitle}</p>
          </div>
          <div className="invoice-meta">
            <p><strong>{payment.invoice_number}</strong></p>
            <p className="hint">{new Date(payment.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="invoice-parties">
          <div>
            <p className="hint">{strings.billedTo}</p>
            <p><strong>{payment.institute_name ?? strings.directCustomer}</strong></p>
          </div>
          <div>
            <p className="hint">{strings.status}</p>
            <span className={`badge ${payment.status === "paid" ? "badge-green" : "badge-amber"}`}>
              {payment.status}
            </span>
          </div>
        </div>

        <table className="data-table invoice-table">
          <thead>
            <tr><th>{t.description}</th><th>{t.amount}</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>{payment.plan_name ?? t.purchase} ({payment.source.toUpperCase()})</td>
              <td>{formatCurrencyAmount(payment.amount, payment.currency)}</td>
            </tr>
            {Number(payment.discount_amount) > 0 && (
              <tr>
                <td>{t.discount} {payment.coupon_code && `(${payment.coupon_code})`}</td>
                <td>- {formatCurrencyAmount(payment.discount_amount, payment.currency)}</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td><strong>{t.total}</strong></td>
              <td><strong>{formatCurrencyAmount(payment.final_amount, payment.currency)}</strong></td>
            </tr>
            {Number(payment.due_amount) > 0 && (
              <>
                <tr>
                  <td>{t.amountPaid}</td>
                  <td>{formatCurrencyAmount(payment.amount_paid, payment.currency)}</td>
                </tr>
                <tr>
                  <td><strong>{t.balanceDue}</strong></td>
                  <td><strong>{formatCurrencyAmount(payment.due_amount, payment.currency)}</strong></td>
                </tr>
              </>
            )}
          </tfoot>
        </table>

        <div className="invoice-footer hint">
          <p>
            {strings.paymentMode} {payment.payment_method_name ?? payment.gateway}
            {payment.gateway_reference && ` — ${payment.gateway_reference}`}
          </p>
          {payment.paid_at && <p>{strings.fullyPaidOn} {new Date(payment.paid_at).toLocaleString()}</p>}
        </div>
      </div>
    </div>
  );
}
