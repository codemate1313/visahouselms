import { type FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Button, Input, Textarea } from "@/components/ui";
import { instituteSignupStrings as strings } from "./InstituteSignup.strings";
import type { LandingPlan, LandingPlansPayload } from "../Plans.types";

const EMPTY = {
  institute_name: "",
  contact_email: "",
  contact_phone: "",
  city: "",
  country: "",
  website: "",
  admin_first_name: "",
  admin_last_name: "",
  admin_email: "",
  expected_students: "",
  message: "",
};

/**
 * The public application to run an institute.
 *
 * Submitting creates nothing but a queued application - no institute, no
 * account, no access. A Super Admin reviews it by hand, and only an approval
 * produces a real admin account, which is why the copy here promises review
 * rather than sign-up.
 */
export function InstituteSignup() {
  const [searchParams] = useSearchParams();
  const planParam = Number(searchParams.get("plan"));
  const interestedPlanId = Number.isFinite(planParam) && planParam > 0 ? planParam : null;

  const [form, setForm] = useState(EMPTY);
  const [interestedPlan, setInterestedPlan] = useState<LandingPlan | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedTo, setSubmittedTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (interestedPlanId === null) return;
    // Purely to name the tier back to them. A failed lookup is not worth
    // mentioning - the application does not depend on it.
    apiClient
      .get<LandingPlansPayload>("/plans", { headers: { "X-Skip-Loader": "true" } })
      .then(({ data }) => {
        setInterestedPlan(data.institutes.find((plan) => plan.id === interestedPlanId) ?? null);
      })
      .catch(() => setInterestedPlan(null));
  }, [interestedPlanId]);

  function set(field: keyof typeof EMPTY) {
    return (event: { target: { value: string } }) =>
      setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiClient.post("/institute-signup", {
        institute_name: form.institute_name,
        contact_email: form.contact_email,
        contact_phone: form.contact_phone || null,
        city: form.city || null,
        country: form.country || null,
        website: form.website || null,
        admin_first_name: form.admin_first_name,
        admin_last_name: form.admin_last_name,
        admin_email: form.admin_email,
        expected_students: form.expected_students ? Number(form.expected_students) : null,
        message: form.message || null,
        interested_plan_id: interestedPlanId,
      });
      setSubmittedTo(form.contact_email);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.submit));
    } finally {
      setSubmitting(false);
    }
  }

  if (submittedTo) {
    return (
      <div className="institute-signup-page">
        <section className="form-card wide institute-signup-done">
          <h1>{strings.success.title}</h1>
          <p className="hint">{strings.success.body(submittedTo)}</p>
          <Link to="/plans">{strings.success.back}</Link>
        </section>
      </div>
    );
  }

  const f = strings.fields;

  return (
    <div className="institute-signup-page">
      <header className="institute-signup-header">
        <span className="institute-signup-eyebrow">{strings.eyebrow}</span>
        <h1>{strings.title}</h1>
        <p>{strings.subtitle}</p>
        {interestedPlan && <p className="hint">{strings.interestedIn(interestedPlan.name)}</p>}
      </header>

      <form className="form-card wide" onSubmit={submit}>
        <h2 className="institute-signup-section">{strings.sections.institute}</h2>
        <label>{f.instituteName} *</label>
        <Input value={form.institute_name} onChange={set("institute_name")} required maxLength={255} />

        <div className="form-grid">
          <div>
            <label>{f.contactEmail} *</label>
            <Input type="email" value={form.contact_email} onChange={set("contact_email")} required />
            <small className="hint">{f.contactEmailHint}</small>
          </div>
          <div>
            <label>{f.contactPhone}</label>
            <Input value={form.contact_phone} onChange={set("contact_phone")} maxLength={40} />
          </div>
        </div>

        <div className="form-grid">
          <div>
            <label>{f.city}</label>
            <Input value={form.city} onChange={set("city")} maxLength={120} />
          </div>
          <div>
            <label>{f.country}</label>
            <Input value={form.country} onChange={set("country")} maxLength={120} />
          </div>
          <div>
            <label>{f.website}</label>
            <Input value={form.website} onChange={set("website")} maxLength={255} />
          </div>
        </div>

        <h2 className="institute-signup-section">{strings.sections.admin}</h2>
        <div className="form-grid">
          <div>
            <label>{f.adminFirstName} *</label>
            <Input value={form.admin_first_name} onChange={set("admin_first_name")} required maxLength={100} />
          </div>
          <div>
            <label>{f.adminLastName} *</label>
            <Input value={form.admin_last_name} onChange={set("admin_last_name")} required maxLength={100} />
          </div>
        </div>
        <label>{f.adminEmail} *</label>
        <Input type="email" value={form.admin_email} onChange={set("admin_email")} required />
        <small className="hint">{f.adminEmailHint}</small>

        <h2 className="institute-signup-section">{strings.sections.context}</h2>
        <div className="form-grid">
          <div>
            <label>{f.expectedStudents}</label>
            <Input type="number" min="0" value={form.expected_students} onChange={set("expected_students")} />
          </div>
        </div>
        <label>{f.message}</label>
        <Textarea
          rows={4}
          value={form.message}
          onChange={set("message")}
          maxLength={2000}
          placeholder={f.messagePlaceholder}
        />

        {error && <p className="error-text">{error}</p>}

        <div className="form-actions">
          <Button type="submit" variant="primary" loading={submitting} disabled={submitting}>
            {submitting ? strings.submitting : strings.submit}
          </Button>
        </div>
      </form>
    </div>
  );
}
