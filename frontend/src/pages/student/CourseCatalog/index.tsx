import { type FormEvent, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import type { StudentPlanCatalogItem } from "@/api/types";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
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
    if (!isInstituteStudent) load();
    // The account type is fixed for the authenticated session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInstituteStudent]);

  async function checkout(event: FormEvent) {
    event.preventDefault();
    if (!checkoutFor) return;
    setBuying(true);
    try {
      await apiClient.post(`/student/plans/${checkoutFor.id}/subscribe`, { coupon_code: couponCode || undefined });
      showSuccess(strings.checkout.purchaseComplete(checkoutFor.name), strings.checkout.purchaseCompleteTitle);
      setCheckoutFor(null);
      setCouponCode("");
      await load();
    } catch (err: unknown) {
      showError(extractErrorMessage(err, strings.checkout.purchaseFailed), strings.checkout.checkoutFailedTitle);
    } finally {
      setBuying(false);
    }
  }

  if (isInstituteStudent) return <Navigate to="/student/my-courses" replace />;

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="page-eyebrow">{strings.eyebrow}</span>
          <h1>{strings.title}</h1>
          <p className="page-subtitle">{strings.subtitle}</p>
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p>{strings.loading}</p>
      ) : plans.length === 0 ? (
        <div className="empty-state">
          <h2>{strings.empty.title}</h2>
          <p>{strings.empty.description}</p>
        </div>
      ) : (
        <PlanGrid plans={plans} onGoToCourse={() => navigate("/student/my-courses")} onChoosePlan={setCheckoutFor} />
      )}

      {checkoutFor && (
        <CheckoutModal
          plan={checkoutFor}
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
