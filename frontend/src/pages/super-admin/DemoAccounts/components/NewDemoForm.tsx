import type { FormEvent } from "react";
import { demoAccountsStrings as strings } from "../DemoAccounts.strings";

interface DemoFormState {
  name: string;
  admin_email: string;
  admin_first_name: string;
  admin_last_name: string;
  duration_days: string;
  course_limit: string;
  test_limit: string;
}

interface NewDemoFormProps {
  form: DemoFormState;
  set: (field: keyof DemoFormState) => (event: { target: { value: string } }) => void;
  error: string | null;
  saving: boolean;
  onSubmit: (event: FormEvent) => void;
}

export function NewDemoForm({ form, set, error, saving, onSubmit }: NewDemoFormProps) {
  const t = strings.form;
  return (
    <form className="form-card wide onboarding-section-card" onSubmit={onSubmit} style={{ marginBottom: 24 }}>
      <h2>{t.heading}</h2>
      <p className="hint" style={{ marginBottom: 16 }}>
        {t.description}
      </p>

      <label htmlFor="name">{t.instituteName}</label>
      <input id="name" value={form.name} onChange={set("name")} required placeholder={t.instituteNamePlaceholder} />

      <h3 className="section-subheading" style={{ marginTop: 20 }}>
        {t.demoAdminHeading}
      </h3>
      <label htmlFor="admin_email">{t.adminEmail}</label>
      <input id="admin_email" type="email" value={form.admin_email} onChange={set("admin_email")} required placeholder={t.adminEmailPlaceholder} />

      <div className="form-grid" style={{ marginTop: 12 }}>
        <div>
          <label htmlFor="admin_first_name">{t.firstName}</label>
          <input id="admin_first_name" value={form.admin_first_name} onChange={set("admin_first_name")} required />
        </div>
        <div>
          <label htmlFor="admin_last_name">{t.lastName}</label>
          <input id="admin_last_name" value={form.admin_last_name} onChange={set("admin_last_name")} required />
        </div>
        <div>
          <label htmlFor="duration_days">{t.durationDays}</label>
          <input id="duration_days" type="number" min="1" value={form.duration_days} onChange={set("duration_days")} required />
        </div>
        <div>
          <label htmlFor="course_limit">{t.courseLimit}</label>
          <input id="course_limit" type="number" min="0" value={form.course_limit} onChange={set("course_limit")} required />
        </div>
        <div>
          <label htmlFor="test_limit">{t.testLimit}</label>
          <input id="test_limit" type="number" min="0" value={form.test_limit} onChange={set("test_limit")} required />
        </div>
      </div>

      {error && <p className="error-text" style={{ marginTop: 12 }}>{error}</p>}

      <div className="form-actions" style={{ marginTop: 20 }}>
        <button type="submit" className="primary-submit-btn" disabled={saving}>
          {saving ? t.creating : t.create}
        </button>
      </div>
    </form>
  );
}
