import { type FormEvent, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import type { StudentPlanCatalogItem } from "../../api/types";
import { useAuthStore } from "../../store/authStore";
import { useToastStore } from "../../store/toastStore";

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
      setError("Failed to load the plan catalog.");
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
      showSuccess(`You now have access to "${checkoutFor.name}".`, "Purchase Complete");
      setCheckoutFor(null);
      setCouponCode("");
      await load();
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Purchase failed."), "Checkout Failed");
    } finally {
      setBuying(false);
    }
  }

  if (isInstituteStudent) return <Navigate to="/student/my-courses" replace />;

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="page-eyebrow">Catalog</span>
          <h1>Learning Plans</h1>
          <p className="page-subtitle">
            Browse available plans and choose the assessment access you need.
          </p>
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : plans.length === 0 ? (
        <div className="empty-state"><h2>No plans available yet</h2><p>Check back soon.</p></div>
      ) : (
        <div className="module-list-grid">
          {plans.map((plan) => (
            <div className="module-record-card" key={plan.id}>
              <div className="section-chip">{plan.duration_days} days</div>
              <h2>{plan.name}</h2>
              <p>{plan.description || "Assessment access plan."}</p>
              <div className="course-meta">
                <span>{plan.module_count} test{plan.module_count === 1 ? "" : "s"}</span>
                <span>{plan.currency} {Number(plan.price).toLocaleString("en-IN")}</span>
              </div>
              {plan.entitled ? (
                <button onClick={() => navigate("/student/my-courses")}>Go to course →</button>
              ) : (
                <button onClick={() => setCheckoutFor(plan)}>Choose plan</button>
              )}
            </div>
          ))}
        </div>
      )}

      {checkoutFor && (
        <div className="modal-backdrop" onClick={() => setCheckoutFor(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>Choose "{checkoutFor.name}"</h2>
            <p>{checkoutFor.currency} {Number(checkoutFor.price).toLocaleString("en-IN")}</p>
            <form onSubmit={checkout} className="form-card">
              <label htmlFor="coupon">Coupon code (optional)</label>
              <input id="coupon" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="e.g. WELCOME10" />
              <div className="form-actions">
                <button type="button" className="secondary-button" onClick={() => setCheckoutFor(null)}>Cancel</button>
                <button type="submit" disabled={buying}>{buying ? "Processing..." : "Confirm purchase"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
