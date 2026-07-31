import { type FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import type { StudentPlanCatalogItem } from "@/api/types";
import { PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { courseCatalogStrings as strings } from "./CourseCatalog.strings";
import { PlanGrid } from "./components/PlanGrid";
import { CheckoutModal } from "./components/CheckoutModal";

async function loadRazorpayScript(): Promise<boolean> {
  if (typeof window !== "undefined" && (window as unknown as { Razorpay?: unknown }).Razorpay) return true;

  const urls = [
    "https://checkout.razorpay.com/v1/checkout.js",
    "https://checkout-static.razorpay.com/v1/checkout.js",
  ];

  for (const url of urls) {
    let scriptEl = document.querySelector(`script[src="${url}"]`) as HTMLScriptElement | null;

    if (scriptEl) {
      for (let i = 0; i < 15; i += 1) {
        if ((window as unknown as { Razorpay?: unknown }).Razorpay) return true;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (!(window as unknown as { Razorpay?: unknown }).Razorpay) {
        scriptEl.remove();
        scriptEl = null;
      }
    }

    if (!scriptEl) {
      const loaded = await new Promise<boolean>((resolve) => {
        const script = document.createElement("script");
        script.src = url;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
      });

      if (loaded && (window as unknown as { Razorpay?: unknown }).Razorpay) {
        return true;
      }
    }
  }

  return Boolean((window as unknown as { Razorpay?: unknown }).Razorpay);
}






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
      loadRazorpayScript();
      apiClient.get<{ default_currency: string } >("/student/detect-location")
        .then((res) => {
          if (res.data?.default_currency === "USD") {
            setSelectedCurrency("USD");
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
      const isUSD = selectedCurrency === "USD" && checkoutFor.is_international_enabled;

      if (!isUSD) {
        // Pre-check: ensure Razorpay SDK is already loaded for INR orders
        const isLoaded = await loadRazorpayScript();
        if (!isLoaded) {
          showError(
            "The Razorpay payment window could not be opened. " +
            "Please open this page in a regular (non-Incognito) Chrome window and disable any ad-blockers, " +
            "then try again.",
            "Payment Gateway Blocked"
          );
          setBuying(false);
          return;
        }
      }

      const { data } = await apiClient.post<{
        online_payment: boolean;
        gateway?: string;
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

      // 2. Razorpay Checkout Flow
      if (data.online_payment && data.gateway === "razorpay" && data.order_id && data.key_id && data.payment_id) {
        const options = {
          key: data.key_id,
          amount: data.amount,
          currency: data.currency || "INR",
          name: "Visa House IELTS LMS",
          description: `${data.plan_name} Purchase`,
          image: "/brand/vh-mark-96.png",
          order_id: data.order_id,
          handler: async function (response: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) {
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
          modal: {
            ondismiss: function () {
              setBuying(false);
            },
          },
          prefill: {
            name: `${user?.first_name || ""} ${user?.last_name || ""}`.trim(),
            email: user?.email || "",
          },
          theme: {
            color: "#dc2626",
          },
        };

        const RazorpayCtor = (window as unknown as { Razorpay: new (opts: typeof options) => { open: () => void; on: (evt: string, fn: (res: unknown) => void) => void } }).Razorpay;
        const razorpay = new RazorpayCtor(options);
        razorpay.on("payment.failed", function (response: unknown) {
          const errRes = response as { error?: { description?: string } };
          showError(errRes.error?.description || "Payment failed", "Payment Failed");
          setBuying(false);
        });
        razorpay.open();
      } else {
        // Fallback / Instant Manual Purchase
        handlePurchaseSuccess(checkoutFor.name);
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
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              background: "#e2e8f0",
              padding: "3px",
              borderRadius: "10px",
              fontSize: "12px",
              fontWeight: 700,
            }}>
              <button
                type="button"
                onClick={() => setSelectedCurrency("INR")}
                style={{
                  padding: "5px 12px",
                  borderRadius: "8px",
                  border: "none",
                  background: selectedCurrency === "INR" ? "#fff" : "transparent",
                  color: selectedCurrency === "INR" ? "#c8202e" : "#64748b",
                  boxShadow: selectedCurrency === "INR" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  cursor: "pointer",
                  fontWeight: 800,
                  transition: "all 0.15s",
                }}
              >
                ₹ INR (India)
              </button>
              <button
                type="button"
                onClick={() => setSelectedCurrency("USD")}
                style={{
                  padding: "5px 12px",
                  borderRadius: "8px",
                  border: "none",
                  background: selectedCurrency === "USD" ? "#fff" : "transparent",
                  color: selectedCurrency === "USD" ? "#2563eb" : "#64748b",
                  boxShadow: selectedCurrency === "USD" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  cursor: "pointer",
                  fontWeight: 800,
                  transition: "all 0.15s",
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
                gap: "0.5rem",
                padding: "0.5rem 1rem",
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                fontWeight: 600,
                color: "#334155",
                textDecoration: "none",
              }}
            >
              <Icon name="transactions" style={{ fontSize: "16px" }} />
              Purchase History
            </Link>
          </div>
        }

      />

      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p>{strings.loading}</p>
      ) : plans.length === 0 ? (
        <div className="empty-state">
          <h2>{strings.empty.title}</h2>
          <p>{strings.empty.description}</p>
        </div>
      ) : (
        <PlanGrid
          plans={plans}
          selectedCurrency={selectedCurrency}
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
