import { type FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Button, RequiredMark, SearchableSelect } from "@/components/ui";
import { noChangesMessage } from "@/content/common.strings";
import { useToastStore } from "@/store/toastStore";
import { isEqual } from "@/utils/isEqual";
import type { PlanRow } from "./Plans";
import { couponFormStrings as strings } from "./CouponForm.strings";

const EMPTY_FORM = {
  code: "",
  discount_type: "percent" as "percent" | "flat",
  value: "",
  scope: "all" as "all" | "plan",
  scope_plan_id: "",
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const showInfo = useToastStore((state) => state.showInfo);
  const originalRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    apiClient.get<PlanRow[]>("/super-admin/plans").then(({ data }) => setPlans(data));
  }, []);

  useEffect(() => {
    if (isNew) return;
    apiClient
      .get(`/super-admin/coupons/${id}`)
      .then(({ data }) => {
        const loadedForm = {
          code: data.code ?? "",
          discount_type: data.discount_type ?? "percent",
          value: String(data.value ?? ""),
          scope: data.scope ?? "all",
          scope_plan_id: data.scope_plan_id ? String(data.scope_plan_id) : "",
          usage_limit: data.usage_limit ? String(data.usage_limit) : "",
          valid_from: data.valid_from ? data.valid_from.slice(0, 10) : "",
          valid_until: data.valid_until ? data.valid_until.slice(0, 10) : "",
        };
        setForm(loadedForm);
        originalRef.current = {
          code: loadedForm.code,
          discount_type: loadedForm.discount_type,
          value: Number(loadedForm.value),
          scope: loadedForm.scope,
          scope_plan_id: loadedForm.scope === "plan" && loadedForm.scope_plan_id ? Number(loadedForm.scope_plan_id) : null,
          usage_limit: loadedForm.usage_limit ? Number(loadedForm.usage_limit) : null,
          valid_from: loadedForm.valid_from ? `${loadedForm.valid_from}T00:00:00` : null,
          valid_until: loadedForm.valid_until ? `${loadedForm.valid_until}T23:59:59` : null,
        };
      })
      .catch(() => setError(strings.errors.load))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  function set(field: keyof typeof EMPTY_FORM) {
    return (event: { target: { value: string } }) =>
      setForm((prev) => ({ ...prev, [field]: event.target.value as never }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (form.discount_type === "percent" && Number(form.value) > 100) {
      setError(strings.errors.percentTooHigh);
      return;
    }
    if (form.valid_from && form.valid_until && form.valid_until < form.valid_from) {
      setError(strings.errors.invalidDateRange);
      return;
    }
    const payload = {
      code: form.code,
      discount_type: form.discount_type,
      value: Number(String(form.value).replace(/,/g, ".")),
      scope: form.scope,
      scope_plan_id: form.scope === "plan" && form.scope_plan_id ? Number(form.scope_plan_id) : null,
      usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
      valid_from: form.valid_from ? `${form.valid_from}T00:00:00` : null,
      valid_until: form.valid_until ? `${form.valid_until}T23:59:59` : null,
    };
    if (originalRef.current && isEqual(originalRef.current, payload)) {
      showInfo(noChangesMessage);
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        await apiClient.post("/super-admin/coupons", payload);
      } else {
        await apiClient.patch(`/super-admin/coupons/${id}`, payload);
        originalRef.current = payload;
      }
      navigate("/super-admin/coupons");
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.save));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>{strings.loading}</p>;

  return (
    <div>
      <h1>{isNew ? strings.newTitle : strings.editTitle}</h1>
      <form className="form-card wide" onSubmit={handleSubmit}>
        <label htmlFor="code">{strings.codeLabel}<RequiredMark /></label>
        <input
          id="code"
          value={form.code}
          onChange={set("code")}
          disabled={!isNew}
          placeholder={strings.codePlaceholder}
          required
        />
        {!isNew && <p className="hint">{strings.codeImmutableHint}</p>}

        <div className="form-grid">
          <div>
            <label htmlFor="discount_type">{strings.discountTypeLabel}</label>
            <SearchableSelect
              id="discount_type"
              options={[
                { value: "percent", label: strings.discountTypes.percent },
                { value: "flat", label: strings.discountTypes.flat },
              ]}
              value={form.discount_type}
              onChange={(value) => setForm((prev) => ({ ...prev, discount_type: String(value) as typeof prev.discount_type }))}
              searchable={false}
              disabled={!isNew}
              className="form-dropdown-select"
            />
          </div>
          <div>
            <label htmlFor="value">{strings.valueLabel(form.discount_type === "percent")}<RequiredMark /></label>
            <input
              id="value"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={form.value}
              onChange={(e) => {
                const val = e.target.value.replace(/,/g, ".");
                if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
                  set("value")({ target: { value: val } });
                }
              }}
              placeholder="0.00"
              required
            />
          </div>
          <div>
            <label htmlFor="scope">{strings.scopeLabel}</label>
            <SearchableSelect
              id="scope"
              options={[
                { value: "all", label: strings.scopes.all },
                { value: "plan", label: strings.scopes.plan },
              ]}
              value={form.scope}
              onChange={(value) => setForm((prev) => ({ ...prev, scope: String(value) as typeof prev.scope }))}
              searchable={false}
              className="form-dropdown-select"
            />
          </div>
          {form.scope === "plan" && (
            <div>
              <label htmlFor="scope_plan_id">{strings.planLabel}</label>
              <SearchableSelect
                id="scope_plan_id"
                options={[{ value: "", label: strings.selectPlanPlaceholder }, ...plans.map((plan) => ({ value: plan.id, label: plan.name }))]}
                value={form.scope_plan_id}
                onChange={(value) => setForm((prev) => ({ ...prev, scope_plan_id: String(value) }))}
                searchPlaceholder={strings.searchPlansPlaceholder}
                className="form-dropdown-select"
              />
            </div>
          )}
          <div>
            <label htmlFor="usage_limit">{strings.usageLimitLabel}</label>
            <input id="usage_limit" type="number" min="1" value={form.usage_limit} onChange={set("usage_limit")} placeholder={strings.usageLimitPlaceholder} />
            <p className="hint">{strings.usageLimitHint}</p>
          </div>
          <div>
            <label htmlFor="valid_from">{strings.validFromLabel}</label>
            <input id="valid_from" type="date" value={form.valid_from} onChange={set("valid_from")} />
          </div>
          <div>
            <label htmlFor="valid_until">{strings.validUntilLabel}</label>
            <input id="valid_until" type="date" value={form.valid_until} onChange={set("valid_until")} />
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="form-actions">
          <Button type="submit" variant="primary" loading={saving} disabled={saving}>
            {saving ? strings.saving : strings.saveCoupon}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/super-admin/coupons")}>
            {strings.cancel}
          </Button>
        </div>
      </form>
    </div>
  );
}
