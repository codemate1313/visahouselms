import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";

const EMPTY_FORM = {
  name: "",
  description: "",
  price: "",
  currency: "INR",
  duration_days: "30",
  student_limit: "50",
  staff_limit: "5",
  test_limit: "20",
  grace_days: "7",
};

export function PlanForm() {
  const { id } = useParams();
  const isNew = id === "new" || id === undefined;
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) return;
    apiClient
      .get(`/super-admin/plans/${id}`)
      .then(({ data }) => {
        setForm({
          name: data.name ?? "",
          description: data.description ?? "",
          price: data.price ?? "",
          currency: data.currency ?? "INR",
          duration_days: String(data.duration_days ?? ""),
          student_limit: String(data.student_limit ?? ""),
          staff_limit: String(data.staff_limit ?? ""),
          test_limit: String(data.test_limit ?? ""),
          grace_days: String(data.grace_days ?? ""),
        });
      })
      .catch(() => setError("Failed to load plan."))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  function set(field: keyof typeof EMPTY_FORM) {
    return (event: { target: { value: string } }) =>
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    const payload = {
      name: form.name,
      description: form.description || null,
      price: Number(form.price),
      currency: form.currency,
      duration_days: Number(form.duration_days),
      student_limit: Number(form.student_limit),
      staff_limit: Number(form.staff_limit),
      test_limit: Number(form.test_limit),
      grace_days: Number(form.grace_days),
    };
    try {
      if (isNew) {
        await apiClient.post("/super-admin/plans", payload);
      } else {
        await apiClient.patch(`/super-admin/plans/${id}`, payload);
      }
      navigate("/super-admin/plans");
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to save plan."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1>{isNew ? "New Plan" : "Edit Plan"}</h1>
      <form className="form-card wide" onSubmit={handleSubmit}>
        <label htmlFor="name">Name</label>
        <input id="name" value={form.name} onChange={set("name")} required />

        <label htmlFor="description">Description</label>
        <input id="description" value={form.description} onChange={set("description")} placeholder="Optional" />

        <div className="form-grid">
          <div>
            <label htmlFor="price">Price</label>
            <input id="price" type="number" min="0" step="0.01" value={form.price} onChange={set("price")} required />
          </div>
          <div>
            <label htmlFor="currency">Currency</label>
            <input id="currency" value={form.currency} onChange={set("currency")} required />
          </div>
          <div>
            <label htmlFor="duration_days">Duration (days)</label>
            <input id="duration_days" type="number" min="1" value={form.duration_days} onChange={set("duration_days")} required />
          </div>
          <div>
            <label htmlFor="grace_days">Grace period (days)</label>
            <input id="grace_days" type="number" min="0" value={form.grace_days} onChange={set("grace_days")} required />
          </div>
          <div>
            <label htmlFor="student_limit">Student limit</label>
            <input id="student_limit" type="number" min="0" value={form.student_limit} onChange={set("student_limit")} required />
          </div>
          <div>
            <label htmlFor="staff_limit">Staff limit</label>
            <input id="staff_limit" type="number" min="0" value={form.staff_limit} onChange={set("staff_limit")} required />
          </div>
          <div>
            <label htmlFor="test_limit">Test limit</label>
            <input id="test_limit" type="number" min="0" value={form.test_limit} onChange={set("test_limit")} required />
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="form-actions">
          <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Plan"}</button>
          <button type="button" onClick={() => navigate("/super-admin/plans")}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
