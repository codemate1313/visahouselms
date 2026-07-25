import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { instituteBillingStrings as strings } from "./InstituteBilling.strings";
import type { Payment, SubscriptionStatus } from "./types";
import { SubscriptionSummary } from "./components/SubscriptionSummary";
import { PaymentHistoryTable } from "./components/PaymentHistoryTable";

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
      setError(extractErrorMessage(err, strings.errors.load));
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="page-eyebrow">{strings.eyebrow}</span>
          <h1>{strings.title}</h1>
          <p className="page-subtitle">{strings.subtitle}</p>
        </div>
      </div>

      {subscription && <SubscriptionSummary subscription={subscription} />}
      {error && <p className="error-text">{error}</p>}

      <PaymentHistoryTable payments={payments} />
    </div>
  );
}
