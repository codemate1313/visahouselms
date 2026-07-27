import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Checkbox, RequiredMark } from "@/components/ui";
import { directStudentCatalogue as catalogue, planFormStrings as strings } from "./PlanForm.strings";
import { PlanCoursePicker, type PlanModule } from "./components/PlanCoursePicker";
import { PlanFeatureEditor } from "./components/PlanFeatureEditor";

// Mirrors MAX_FEATURES in app/schemas/plan.py.
const MAX_FEATURES = 12;

const EMPTY = { name: "", description: "", price: "", currency: "INR", duration_days: "30", student_limit: "1", staff_limit: "0", test_limit: "20", grace_days: "0", is_published: false };

export function PlanForm() {
  const { id } = useParams();
  const isNew = id === "new" || !id;
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [modules, setModules] = useState<PlanModule[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [features, setFeatures] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([apiClient.get<PlanModule[]>("/super-admin/plans/available-modules"), ...(isNew ? [] : [apiClient.get(`/super-admin/plans/${id}`)])])
      .then((responses) => {
        setModules(responses[0].data);
        if (!isNew) {
          const data = responses[1].data;
          setForm({
            name: data.name || "",
            description: data.description || "",
            price: data.price || "",
            currency: data.currency || "INR",
            duration_days: String(data.duration_days),
            student_limit: String(data.student_limit),
            staff_limit: String(data.staff_limit),
            test_limit: String(data.test_limit),
            grace_days: String(data.grace_days),
            is_published: Boolean(data.is_published),
          });
          setSelected(new Set((data.modules || []).map((module: PlanModule) => module.id)));
          setFeatures(data.features || []);
        }
      })
      .catch(() => setError(strings.errors.load))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  function set(field: keyof typeof EMPTY) {
    return (event: { target: { value: string } }) => setForm((current) => ({ ...current, [field]: event.target.value }));
  }
  function toggle(moduleId: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(moduleId)) next.delete(moduleId); else next.add(moduleId);
      return next;
    });
  }
  function toggleAll() {
    setSelected((current) => (current.size === modules.length ? new Set() : new Set(modules.map((module) => module.id))));
  }
  function setFeature(index: number, value: string) {
    setFeatures((current) => current.map((item, i) => (i === index ? value : item)));
  }
  function addFeature() {
    setFeatures((current) => (current.length >= MAX_FEATURES ? current : [...current, ""]));
  }
  function removeFeature(index: number) {
    setFeatures((current) => current.filter((_, i) => i !== index));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
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
      audience: "direct_students",
      is_published: form.is_published,
      module_ids: [...selected],
      features: features.map((item) => item.trim()).filter(Boolean),
    };
    try {
      if (isNew) await apiClient.post("/super-admin/plans", payload);
      else await apiClient.patch(`/super-admin/plans/${id}`, payload);
      navigate(catalogue.basePath);
    } catch (err) {
      setError(extractErrorMessage(err, strings.errors.save));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>{strings.loading}</p>;

  const f = strings.fields;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{isNew ? catalogue.createTitle : catalogue.editTitle}</h1>
          <p className="page-subtitle">{catalogue.subtitle}</p>
        </div>
      </div>
      <form className="form-card wide" onSubmit={submit}>
        <label>{f.name}<RequiredMark /></label>
        <input value={form.name} onChange={set("name")} required />
        <label>{f.description}</label>
        <textarea rows={3} value={form.description} onChange={set("description")} />
        <div className="form-grid">
          <div>
            <label>{f.price}<RequiredMark /></label>
            <input type="number" min="0" step="0.01" value={form.price} onChange={set("price")} required />
          </div>
          <div>
            <label>{f.currency}<RequiredMark /></label>
            <input value={form.currency} onChange={set("currency")} required />
          </div>
          <div>
            <label>{f.durationDays}<RequiredMark /></label>
            <input type="number" min="1" value={form.duration_days} onChange={set("duration_days")} required />
          </div>
          <div>
            <label>{f.testLimit}<RequiredMark /></label>
            <input type="number" min="0" value={form.test_limit} onChange={set("test_limit")} required />
          </div>
          <div>
            <label>{f.graceDays}<RequiredMark /></label>
            <input type="number" min="0" value={form.grace_days} onChange={set("grace_days")} required />
          </div>
        </div>
        <PlanCoursePicker modules={modules} selected={selected} onToggle={toggle} onToggleAll={toggleAll} />
        <PlanFeatureEditor
          features={features}
          maxFeatures={MAX_FEATURES}
          onChange={setFeature}
          onAdd={addFeature}
          onRemove={removeFeature}
        />
        <label className="toggle-row">
          <Checkbox
            checked={form.is_published}
            onChange={(event) => setForm((current) => ({ ...current, is_published: event.target.checked }))}
          />
          <span>
            <strong>{catalogue.publishLabel}</strong>
            <small>{catalogue.publishHint}</small>
          </span>
        </label>
        {error && <p className="error-text">{error}</p>}
        <div className="form-actions">
          <button disabled={saving || (form.is_published && !selected.size)}>{saving ? strings.saving : strings.savePlan}</button>
          <button type="button" onClick={() => navigate(catalogue.basePath)}>
            {strings.cancel}
          </button>
        </div>
      </form>
    </div>
  );
}
