import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiClient } from "../../api/client";

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
      .catch(() => setError("Failed to load invoice."));
  }, [id]);

  if (error) return <p className="error-text">{error}</p>;
  if (!payment) return <p>Loading...</p>;

  return (
    <div>
      <div className="page-header no-print">
        <h1>Invoice {payment.invoice_number}</h1>
        <button onClick={() => window.print()}>Print</button>
      </div>

      <div className="invoice-card">
        <div className="invoice-header">
          <div>
            <h2>IELTS LMS</h2>
            <p className="hint">Institute plan subscription receipt</p>
          </div>
          <div className="invoice-meta">
            <p><strong>{payment.invoice_number}</strong></p>
            <p className="hint">{new Date(payment.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="invoice-parties">
          <div>
            <p className="hint">Billed to</p>
            <p><strong>{payment.institute_name ?? "Direct customer"}</strong></p>
          </div>
          <div>
            <p className="hint">Status</p>
            <span className={`badge ${payment.status === "paid" ? "badge-green" : "badge-amber"}`}>
              {payment.status}
            </span>
          </div>
        </div>

        <table className="data-table invoice-table">
          <thead>
            <tr><th>Description</th><th>Amount</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>{payment.plan_name ?? "Purchase"} ({payment.source.toUpperCase()})</td>
              <td>{payment.currency} {payment.amount}</td>
            </tr>
            {Number(payment.discount_amount) > 0 && (
              <tr>
                <td>Discount {payment.coupon_code && `(${payment.coupon_code})`}</td>
                <td>- {payment.currency} {payment.discount_amount}</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td><strong>Total</strong></td>
              <td><strong>{payment.currency} {payment.final_amount}</strong></td>
            </tr>
            {Number(payment.due_amount) > 0 && (
              <>
                <tr>
                  <td>Amount paid</td>
                  <td>{payment.currency} {payment.amount_paid}</td>
                </tr>
                <tr>
                  <td><strong>Balance due</strong></td>
                  <td><strong>{payment.currency} {payment.due_amount}</strong></td>
                </tr>
              </>
            )}
          </tfoot>
        </table>

        <div className="invoice-footer hint">
          <p>
            Payment mode: {payment.payment_method_name ?? payment.gateway}
            {payment.gateway_reference && ` — ${payment.gateway_reference}`}
          </p>
          {payment.paid_at && <p>Fully paid on {new Date(payment.paid_at).toLocaleString()}</p>}
        </div>
      </div>
    </div>
  );
}
