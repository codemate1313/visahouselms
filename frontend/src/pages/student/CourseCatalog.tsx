import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import type { CatalogCourse } from "../../api/types";
import { useAuthStore } from "../../store/authStore";
import { useToastStore } from "../../store/toastStore";

export function CourseCatalog() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);
  const [courses, setCourses] = useState<CatalogCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutFor, setCheckoutFor] = useState<CatalogCourse | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [buying, setBuying] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await apiClient.get<CatalogCourse[]>("/student/courses");
      setCourses(data);
      setError(null);
    } catch {
      setError("Failed to load the course catalog.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function checkout(event: FormEvent) {
    event.preventDefault();
    if (!checkoutFor) return;
    setBuying(true);
    try {
      await apiClient.post(`/student/courses/${checkoutFor.id}/checkout`, { coupon_code: couponCode || undefined });
      showSuccess(`You now have access to "${checkoutFor.title}".`, "Purchase Complete");
      setCheckoutFor(null);
      setCouponCode("");
      await load();
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Purchase failed."), "Checkout Failed");
    } finally {
      setBuying(false);
    }
  }

  const isInstituteStudent = user?.institute_id != null;

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="page-eyebrow">Catalog</span>
          <h1>Course Catalog</h1>
          <p className="page-subtitle">
            {isInstituteStudent
              ? "Courses your institute has assigned appear as \"Entitled\"."
              : "Browse published courses and purchase the ones you need."}
          </p>
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : courses.length === 0 ? (
        <div className="empty-state"><h2>No courses available yet</h2><p>Check back soon.</p></div>
      ) : (
        <div className="module-list-grid">
          {courses.map((course) => (
            <div className="module-record-card" key={course.id}>
              <div className="section-chip">{course.level}</div>
              <h2>{course.title}</h2>
              <p>{course.summary || "No summary added yet."}</p>
              <div className="course-meta">
                <span>{course.module_count} module{course.module_count === 1 ? "" : "s"}</span>
                {course.estimated_duration_minutes && <span>{course.estimated_duration_minutes} min</span>}
                <span>{course.currency} {Number(course.price).toLocaleString("en-IN")}</span>
              </div>
              {course.entitled ? (
                <button onClick={() => navigate("/student/my-courses")}>Go to course →</button>
              ) : isInstituteStudent ? (
                <button disabled className="secondary-button">Not assigned by your institute</button>
              ) : (
                <button onClick={() => setCheckoutFor(course)}>Buy course</button>
              )}
            </div>
          ))}
        </div>
      )}

      {checkoutFor && (
        <div className="modal-backdrop" onClick={() => setCheckoutFor(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>Purchase "{checkoutFor.title}"</h2>
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
