import { type FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Checkbox, PageHeader, RequiredMark, SearchableSelect } from "@/components/ui";
import { noChangesMessage } from "@/content/common.strings";
import { useToastStore } from "@/store/toastStore";
import { isEqual } from "@/utils/isEqual";

import { planFormCatalogues, planFormStrings as strings, type PlanAudience } from "./PlanForm.strings";
import { PlanCoursePicker, type PlanModule } from "./components/PlanCoursePicker";
import { PlanFeatureEditor } from "./components/PlanFeatureEditor";

// Mirrors MAX_FEATURES in app/schemas/plan.py.
const MAX_FEATURES = 12;

const EMPTY = { name: "", description: "", price: "", currency: "INR", duration_days: "30", student_limit: "1", staff_limit: "0", grace_days: "0", is_published: false, gst_rate_id: "", is_international_enabled: false, usd_price: "" };

interface GstOption {
  id: number;
  name: string;
  percentage: number;
  tax_type: string;
  is_active: boolean;
  is_default: boolean;
}

export function PlanForm() {
  const { id } = useParams();
  const isNew = id === "new" || !id;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // New plans take their catalogue from the tab that launched the form; an
  // existing plan keeps its own, which is read back with the rest of the row.
  const [audience, setAudience] = useState<PlanAudience>(
    searchParams.get("audience") === "institutes" ? "institutes" : "direct_students",
  );
  const catalogue = planFormCatalogues[audience];
  const [form, setForm] = useState(EMPTY);
  const [modules, setModules] = useState<PlanModule[]>([]);
  const [gstRates, setGstRates] = useState<GstOption[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [features, setFeatures] = useState<string[]>([""]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showInfo = useToastStore((state) => state.showInfo);
  const originalRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    Promise.all([
      apiClient.get<PlanModule[]>("/super-admin/plans/available-modules"),
      apiClient.get<GstOption[]>("/super-admin/gst-rates"),
      ...(isNew ? [] : [apiClient.get(`/super-admin/plans/${id}`)]),
    ])
      .then((responses) => {
        setModules(responses[0].data);
        setGstRates(responses[1].data);
        if (isNew) {
          const defaultGst = responses[1].data.find((r) => r.is_default);
          if (defaultGst) {
            setForm((prev) => ({ ...prev, gst_rate_id: String(defaultGst.id) }));
          }
        } else {
          const data = responses[2].data;
          const loadedForm = {
            name: data.name || "",
            description: data.description || "",
            price: data.price || "",
            currency: data.currency || "INR",
            duration_days: String(data.duration_days),
            student_limit: String(data.student_limit),
            staff_limit: String(data.staff_limit),
            grace_days: String(data.grace_days),
            is_published: Boolean(data.is_published),
            gst_rate_id: data.gst_rate_id ? String(data.gst_rate_id) : "",
            is_international_enabled: Boolean(data.is_international_enabled),
            usd_price: data.usd_price ? String(data.usd_price) : "",
          };
          setForm(loadedForm);
          const loadedAudience: PlanAudience = data.audience === "institutes" ? "institutes" : audience;
          if (data.audience === "institutes") setAudience("institutes");
          const loadedSelected = new Set<number>((data.modules || []).map((module: PlanModule) => module.id));
          setSelected(loadedSelected);
          // Features are required; start with one blank row so plans saved
          // before this field existed are still editable.
          const loadedFeatures = data.features?.length ? data.features : [""];
          setFeatures(loadedFeatures);
          originalRef.current = {
            name: loadedForm.name,
            description: loadedForm.description || null,
            price: Number(loadedForm.price),
            currency: loadedForm.currency,
            duration_days: Number(loadedForm.duration_days),
            student_limit: Number(loadedForm.student_limit),
            staff_limit: Number(loadedForm.staff_limit),
            grace_days: Number(loadedForm.grace_days),
            gst_rate_id: loadedForm.gst_rate_id ? Number(loadedForm.gst_rate_id) : null,
            is_international_enabled: loadedForm.is_international_enabled,
            usd_price: loadedForm.is_international_enabled && loadedForm.usd_price ? Number(loadedForm.usd_price) : null,
            audience: loadedAudience,
            is_published: loadedForm.is_published,
            module_ids: [...loadedSelected],
            features: loadedFeatures.map((item: string) => item.trim()).filter(Boolean),
          };
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
    setError(null);

    const cleanedFeatures = features.map((item) => item.trim()).filter(Boolean);
    if (cleanedFeatures.length === 0) {
      setError(strings.errors.featuresRequired);
      if (!features.length) setFeatures([""]);
      const firstFeatureInput = document.querySelector<HTMLInputElement>(".plan-feature-editor input");
      firstFeatureInput?.scrollIntoView({ behavior: "smooth", block: "center" });
      firstFeatureInput?.focus({ preventScroll: true });
      return;
    }

    const payload = {
      name: form.name,
      description: form.description || null,
      price: Number(form.price),
      currency: form.currency,
      duration_days: Number(form.duration_days),
      student_limit: Number(form.student_limit),
      staff_limit: Number(form.staff_limit),
      grace_days: Number(form.grace_days),
      gst_rate_id: form.gst_rate_id ? Number(form.gst_rate_id) : null,
      is_international_enabled: form.is_international_enabled,
      usd_price: form.is_international_enabled && form.usd_price ? Number(form.usd_price) : null,
      audience,
      is_published: form.is_published,
      module_ids: [...selected],
      features: cleanedFeatures,
    };
    if (originalRef.current && isEqual(originalRef.current, payload)) {
      showInfo(noChangesMessage);
      return;
    }
    setSaving(true);
    try {
      if (isNew) await apiClient.post("/super-admin/plans", payload);
      else {
        await apiClient.patch(`/super-admin/plans/${id}`, payload);
        originalRef.current = payload;
      }
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
      <PageHeader title={isNew ? catalogue.createTitle : catalogue.editTitle} subtitle={catalogue.subtitle} />
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
            <label>GST Tax Rate</label>
            <SearchableSelect
              value={form.gst_rate_id}
              onChange={(val) => setForm((prev) => ({ ...prev, gst_rate_id: String(val) }))}
              options={[
                { value: "", label: "No GST (0% / Exempt)", sublabel: "No tax applied to this plan" },
                ...gstRates.map((rate) => ({
                  value: String(rate.id),
                  label: `${rate.name} (${rate.percentage}%)`,
                  sublabel: rate.tax_type === "inclusive" ? "Included in Price (Inclusive)" : "Added On Top (Exclusive)",
                })),
              ]}
              placeholder="Select GST Tax Rate..."
              searchable={false}
            />
          </div>

          <div>
            <label>{f.durationDays}<RequiredMark /></label>
            <input type="number" min="1" value={form.duration_days} onChange={set("duration_days")} required />
          </div>
          <div>
            <label>{f.graceDays}<RequiredMark /></label>
            <input type="number" min="0" value={form.grace_days} onChange={set("grace_days")} required />
          </div>
        </div>

        {/* International Pricing Section */}
        <div style={{
          margin: "18px 0 24px",
          padding: "16px 20px",
          background: "linear-gradient(135deg, var(--surface-muted) 0%, var(--surface) 100%)",
          border: "1.5px solid var(--border)",
          borderRadius: "14px",
        }}>
          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontWeight: 700, fontSize: "14px", color: "var(--text)" }}>
            <Checkbox
              checked={Boolean(form.is_international_enabled)}
              onChange={(e) => setForm((prev) => ({ ...prev, is_international_enabled: e.target.checked }))}
            />

            <span>Enable for International Students (USD Pricing & Stripe)</span>
          </label>

          {form.is_international_enabled && (
            <div style={{ marginTop: "14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>
                  International Price (USD $)<RequiredMark />
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 59.00"
                  value={form.usd_price}
                  onChange={set("usd_price")}
                  required={form.is_international_enabled}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)" }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", fontSize: "12px", color: "var(--text-muted)", background: "var(--surface)", padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--border)" }}>
                <span>Students outside India will be presented <strong>${form.usd_price || "0.00"} USD</strong> and paid via <strong>Stripe Payment Gateway</strong>.</span>
              </div>
            </div>
          )}
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
