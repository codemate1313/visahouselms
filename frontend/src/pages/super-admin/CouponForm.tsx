import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import type { PlanRow } from "./Plans";
import type { Course } from "../../api/types";

const EMPTY_FORM = {
  code: "",
  discount_type: "percent" as "percent" | "flat",
  value: "",
  scope: "all" as "all" | "plan" | "course",
  scope_plan_id: "",
  scope_course_id: "",
  usage_limit: "",
  valid_from: "",
  valid_until: "",
};

export function CouponForm() {
  const { id } = useParams();
  const isNew = id === "new" || id === undefined;
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient.get<PlanRow[]>("/super-admin/plans").then(({ data }) => setPlans(data));
    apiClient.get<Course[]>("/super-admin/courses", { params: { status: "published" } }).then(({ data }) => setCourses(data));
  }, []);

  useEffect(() => {
    if (isNew) return;
    apiClient
      .get(`/super-admin/coupons/${id}`)
      .then(({ data }) => {
        setForm({
          code: data.code ?? "",
          discount_type: data.discount_type ?? "percent",
          value: String(data.value ?? ""),
          scope: data.scope ?? "all",
          scope_plan_id: data.scope_plan_id ? String(data.scope_plan_id) : "",
          scope_course_id: data.scope_course_id ? String(data.scope_course_id) : "",
          usage_limit: data.usage_limit ? String(data.usage_limit) : "",
          valid_from: data.valid_from ? data.valid_from.slice(0, 10) : "",
          valid_until: data.valid_until ? data.valid_until.slice(0, 10) : "",
        });
      })
      .catch(() => setError("Failed to load coupon."))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  function set(field: keyof typeof EMPTY_FORM) {
    return (event: { target: { value: string } }) =>
      setForm((prev) => ({ ...prev, [field]: event.target.value as never }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    const payload = {
      code: form.code,
      discount_type: form.discount_type,
      value: Number(form.value),
      scope: form.scope,
      scope_plan_id: form.scope === "plan" && form.scope_plan_id ? Number(form.scope_plan_id) : null,
      scope_course_id: form.scope === "course" && form.scope_course_id ? Number(form.scope_course_id) : null,
      usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
      valid_from: form.valid_from ? `${form.valid_from}T00:00:00` : null,
      valid_until: form.valid_until ? `${form.valid_until}T23:59:59` : null,
    };
    try {
      if (isNew) {
        await apiClient.post("/super-admin/coupons", payload);
      } else {
        await apiClient.patch(`/super-admin/coupons/${id}`, payload);
      }
      navigate("/super-admin/coupons");
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to save coupon."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1>{isNew ? "New Coupon" : "Edit Coupon"}</h1>
      <form className="form-card wide" onSubmit={handleSubmit}>
        <label htmlFor="code">Code</label>
        <input
          id="code"
          value={form.code}
          onChange={set("code")}
          disabled={!isNew}
          placeholder="WELCOME10"
          required
        />
        {!isNew && <p className="hint">Codes can't be changed after creation.</p>}

        <div className="form-grid">
          <div>
            <label htmlFor="discount_type">Discount type</label>
            <select id="discount_type" value={form.discount_type} onChange={set("discount_type")} disabled={!isNew}>
              <option value="percent">Percent</option>
              <option value="flat">Flat amount</option>
            </select>
          </div>
          <div>
            <label htmlFor="value">Value {form.discount_type === "percent" ? "(%)" : "(₹)"}</label>
            <input id="value" type="number" min="0" step="0.01" value={form.value} onChange={set("value")} required />
          </div>
          <div>
            <label htmlFor="scope">Scope</label>
            <select id="scope" value={form.scope} onChange={set("scope")}>
              <option value="all">All products</option>
              <option value="plan">Specific plan</option>
              <option value="course">Specific course</option>
            </select>
          </div>
          {form.scope === "plan" && (
            <div>
              <label htmlFor="scope_plan_id">Plan</label>
              <select id="scope_plan_id" value={form.scope_plan_id} onChange={set("scope_plan_id")} required>
                <option value="">Select a plan...</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>{plan.name}</option>
                ))}
              </select>
            </div>
          )}
          {form.scope === "course" && (
            <div>
              <label htmlFor="scope_course_id">Course</label>
              <select id="scope_course_id" value={form.scope_course_id} onChange={set("scope_course_id")} required>
                <option value="">Select a published course...</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="usage_limit">Usage limit</label>
            <input id="usage_limit" type="number" min="1" value={form.usage_limit} onChange={set("usage_limit")} placeholder="Unlimited" />
          </div>
          <div>
            <label htmlFor="valid_from">Valid from</label>
            <input id="valid_from" type="date" value={form.valid_from} onChange={set("valid_from")} />
          </div>
          <div>
            <label htmlFor="valid_until">Valid until</label>
            <input id="valid_until" type="date" value={form.valid_until} onChange={set("valid_until")} />
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="form-actions">
          <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Coupon"}</button>
          <button type="button" onClick={() => navigate("/super-admin/coupons")}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
