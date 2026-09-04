import { type FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import type { StudentPlanCatalogItem } from "@/api/types";
import { PageHeader } from "@/components/ui";
import { RouteLoadingState } from "@/components/RouteLoadingState";
import { Icon } from "@/components/icons";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { loadRazorpayScript, openRazorpayCheckout } from "@/utils/razorpay";
import { submitPayuCheckout } from "@/utils/payu";
import { courseCatalogStrings as strings } from "./CourseCatalog.strings";
import { PlanGrid } from "./components/PlanGrid";
import { CheckoutModal } from "./components/CheckoutModal";


export function CourseCatalog() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);
  const [plans, setPlans] = useState<StudentPlanCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutFor, setCheckoutFor] = useState<StudentPlanCatalogItem | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [buying, setBuying] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<"INR" | "USD">("INR");
  const [inrUsdRate, setInrUsdRate] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { data } = await apiClient.get<StudentPlanCatalogItem[]>("/student/plans");
      setPlans(data);
      setError(null);
    } catch {
      setError(strings.loadError);
    } finally {
      setLoading(false);
    }
  }

  const isInstituteStudent = user?.institute_id != null;
  useEffect(() => {
    if (!isInstituteStudent) {
      load();
      apiClient.get<{ default_currency: string; conversion?: { rate: number } }>("/student/detect-location")
        .then((res) => {
          if (res.data?.default_currency === "USD") {
            setSelectedCurrency("USD");
            setInrUsdRate(res.data.conversion?.rate ?? null);
          }
        })
        .catch(() => {});
    }
  }, [isInstituteStudent]);


  async function checkout(event: FormEvent) {
    event.preventDefault();
    if (!checkoutFor) return;
    setBuying(true);
    try {
      /* The Razorpay script is loaded in its own branch below, not here. This
         used to run for every rupee order and refuse to continue when the
         script was blocked - which would now stop a PayU payment, a gateway
         that needs no script at all, because an ad-blocker had eaten a
         Razorpay CDN the order was never going to use. */

      const { data } = await apiClient.post<{
        online_payment: boolean;
        gateway?: string;
        action_url?: string;
        fields?: Record<string, string>;
        order_id?: string;
        payment_intent_id?: string;
        client_secret?: string;
        publishable_key?: string;
        key_id?: string;
        amount?: number;
        currency?: string;
        plan_name?: string;
        payment_id?: number;
      }>(`/student/plans/${checkoutFor.id}/create-order`, {
        coupon_code: couponCode || undefined,
        currency: selectedCurrency,
      });

      function handlePurchaseSuccess(planName: string) {
        showSuccess(strings.checkout.purchaseComplete(planName), strings.checkout.purchaseCompleteTitle);
        setCheckoutFor(null);
        setCouponCode("");
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }

      // 1. Stripe Checkout Flow
      if (data.online_payment && data.gateway === "stripe" && data.payment_intent_id && data.payment_id) {
        try {
          await apiClient.post(`/student/payments/${data.payment_id}/verify-stripe`, {
            payment_intent_id: data.payment_intent_id,
          });
          handlePurchaseSuccess(checkoutFor.name);
        } catch (stripeErr: unknown) {
          showError(extractErrorMessage(stripeErr, "Stripe payment verification failed"), "Stripe Payment Error");
        } finally {
          setBuying(false);
        }
        return;
      }

      // 2. PayU Checkout Flow - a redirect, not a modal.
      if (data.online_payment && data.gateway === "payu" && data.action_url && data.fields) {
        // The page is about to navigate away, so nothing after this runs and
        // the busy state is deliberately left on - the button must not look
        // clickable again while the browser is leaving.
        submitPayuCheckout(data.action_url, data.fields);
        return;
      }

      // 3. Razorpay Checkout Flow
      if (data.online_payment && data.gateway === "razorpay" && data.order_id && data.key_id && data.payment_id) {
        if (!(await loadRazorpayScript())) {
          showError(
            "The Razorpay payment window could not be opened. " +
            "Please open this page in a regular (non-Incognito) Chrome window and disable any ad-blockers, " +
            "then try again.",
            "Payment Gateway Blocked"
          );
          setBuying(false);
          return;
        }
        openRazorpayCheckout({
          keyId: data.key_id,
          orderId: data.order_id,
          amount: data.amount ?? 0,
          currency: data.currency || "INR",
          description: `${data.plan_name} Purchase`,
          prefillName: `${user?.first_name || ""} ${user?.last_name || ""}`.trim(),
          prefillEmail: user?.email || "",
          onSuccess: async (response) => {
            try {
              await apiClient.post(`/student/payments/${data.payment_id}/verify-razorpay`, {
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              });
              handlePurchaseSuccess(checkoutFor.name);
            } catch (verifyErr: unknown) {
              showError(extractErrorMessage(verifyErr, "Razorpay payment verification failed"), "Verification Error");
            } finally {
              setBuying(false);
            }
          },
          onDismiss: () => {
            setBuying(false);
          },
          onFailure: (message) => {
            showError(message, "Payment Failed");
            setBuying(false);
          },
        });
      } else {
        /* No usable gateway came back from create-order, which means payments
           are not configured. This branch used to call handlePurchaseSuccess()
           and reload - telling the student the purchase completed while no
           payment was verified and no subscription was ever created, which is
           why the plan card still read "Choose plan" afterwards. Access is
           never granted without a verified payment. */
        showError(strings.checkout.gatewayUnavailable, strings.checkout.gatewayUnavailableTitle);
        setBuying(false);
      }

    } catch (err: unknown) {
      showError(extractErrorMessage(err, strings.checkout.purchaseFailed), strings.checkout.checkoutFailedTitle);
      setBuying(false);
    }
  }


  if (isInstituteStudent) return <Navigate to="/student/my-courses" replace />;

  return (
    <div>
      <PageHeader
        eyebrow={strings.eyebrow}
        title={strings.title}
        subtitle={strings.subtitle}
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "var(--surface-muted, #f1f5f9)",
                border: "1px solid var(--border, #e2e8f0)",
                padding: "3px",
                borderRadius: "10px",
                fontSize: "12px",
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedCurrency("INR")}
                style={{
                  padding: "5px 12px",
                  borderRadius: "7px",
                  border: "none",
                  background: selectedCurrency === "INR" ? "var(--surface, #fff)" : "transparent",
                  color: selectedCurrency === "INR" ? "var(--primary, #e11d48)" : "var(--text-muted, #64748b)",
                  boxShadow: selectedCurrency === "INR" ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                  cursor: "pointer",
                  fontWeight: 650,
                  transition: "all 0.15s ease",
                }}
              >
                ₹ INR (India)
              </button>
              <button
                type="button"
                onClick={() => setSelectedCurrency("USD")}
                style={{
                  padding: "5px 12px",
                  borderRadius: "7px",
                  border: "none",
                  background: selectedCurrency === "USD" ? "var(--surface, #fff)" : "transparent",
                  color: selectedCurrency === "USD" ? "var(--primary, #e11d48)" : "var(--text-muted, #64748b)",
                  boxShadow: selectedCurrency === "USD" ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                  cursor: "pointer",
                  fontWeight: 650,
                  transition: "all 0.15s ease",
                }}
              >
                $ USD (Global)
              </button>
            </div>

            <Link
              to="/student/purchase-history"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                background: "var(--surface, #ffffff)",
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: "10px",
                fontSize: "12.5px",
                fontWeight: 600,
                color: "var(--text, #0f172a)",
                textDecoration: "none",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              <Icon name="transactions" style={{ fontSize: "14px" }} />
              Purchase History
            </Link>
          </div>
        }

      />

      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <RouteLoadingState />
      ) : plans.length === 0 ? (
        <div className="empty-state">
          <h2>{strings.empty.title}</h2>
          <p>{strings.empty.description}</p>
        </div>
      ) : (
        <PlanGrid
          plans={plans}
          selectedCurrency={selectedCurrency}
          inrUsdRate={inrUsdRate}
          onGoToCourse={() => navigate("/student/my-courses")}
          onChoosePlan={setCheckoutFor}
        />
      )}

      {checkoutFor && (
        <CheckoutModal
          plan={checkoutFor}
          selectedCurrency={selectedCurrency}
          couponCode={couponCode}
          onCouponCodeChange={setCouponCode}
          buying={buying}
          onSubmit={checkout}
          onClose={() => setCheckoutFor(null)}
        />
      )}

    </div>
  );
}
