import { useEffect, useState } from "react";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";

interface Payment {
  id: number;
  invoice_number: string | null;
  plan_name: string | null;
  final_amount: string;
  currency: string;
  status: string;
  created_at: string;
}

interface SubscriptionStatus {
  state: string;
  usage: { students: number; staff: number; tests: number };
  limits: { students: number; staff: number; tests: number | null } | null;
  subscription: { plan_name: string; expires_at: string; days_remaining: number | null } | null;
}

const STATE_CLASS: Record<string, string> = {
  active: "badge-green",
  grace: "badge-amber",
  expired: "badge-red",
  none: "badge-gray",
};

export function InstituteBilling() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [subscriptionResponse, paymentResponse] = await Promise.all([
        apiClient.get<SubscriptionStatus>("/institute/subscription"),
        apiClient.get<Payment[]>("/institute/payments"),
      ]);
      setSubscription(subscriptionResponse.data);
      setPayments(paymentResponse.data);
      setError(null);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to load subscription details."));
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="page-header"><div><span className="page-eyebrow">Subscription</span><h1>Subscription & Payments</h1><p className="page-subtitle">Review the access assigned by the Super Admin.</p></div></div>
      {subscription && (
        <div className="banner"><strong>{subscription.subscription?.plan_name ?? "No active plan"}</strong> <span className={`badge ${STATE_CLASS[subscription.state] ?? "badge-gray"}`}>{subscription.state}</span>{subscription.subscription && ` - valid until ${new Date(subscription.subscription.expires_at).toLocaleDateString()}`}</div>
      )}
      {error && <p className="error-text">{error}</p>}

      {subscription?.limits && (
        <div className="stat-tile-row">
          <div className="stat-tile"><p className="stat-label">Students</p><p className="stat-value">{subscription.usage.students} / {subscription.limits.students}</p></div>
          <div className="stat-tile"><p className="stat-label">Instructors</p><p className="stat-value">{subscription.usage.staff} / {subscription.limits.staff}</p></div>
          <div className="stat-tile"><p className="stat-label">Tests</p><p className="stat-value">{subscription.limits.tests === null ? "Unlimited" : `${subscription.usage.tests} / ${subscription.limits.tests}`}</p></div>
        </div>
      )}

      <h2 className="section-title billing-history-title">Payment history</h2>
      <div className="table-wrap">
        <table className="data-table"><thead><tr><th>Invoice</th><th>Plan</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>
          {payments.length === 0 && <tr><td colSpan={5} className="empty-cell">No payments yet.</td></tr>}
          {payments.map((payment) => <tr key={payment.id}><td>{payment.invoice_number ?? "Pending"}</td><td>{payment.plan_name ?? "-"}</td><td>{payment.currency} {Number(payment.final_amount).toLocaleString("en-IN")}</td><td><span className={`badge ${payment.status === "paid" ? "badge-green" : "badge-amber"}`}>{payment.status}</span></td><td>{new Date(payment.created_at).toLocaleDateString()}</td></tr>)}
        </tbody></table>
      </div>

    </div>
  );
}
