import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { instituteOnboardingStrings as strings } from "../InstituteOnboarding.strings";
import { INITIAL } from "../helpers";

interface Step2BrandingFormProps {
  form: typeof INITIAL;
  set: (field: keyof typeof INITIAL) => (event: { target: { value: string } }) => void;
  instituteName: string | undefined;
  adminCredential: { email: string; password: string } | null;
  onLogoChange: (file: File | null) => void;
  busy: boolean;
  onSave: () => void;
}

export function Step2BrandingForm({ form, set, instituteName, adminCredential, onLogoChange, busy, onSave }: Step2BrandingFormProps) {
  const t = strings.step2;
  return (
    <CollapsiblePanel className="form-card wide" title={t.title} description={t.description}>
      {adminCredential && (
        <section className="credential-sheet">
          <h3>{t.credentialsHeading}</h3>
          <p>{t.credentialsHint}</p>
          <div className="credential-row">
            <code>{adminCredential.email}</code>
            <code>{adminCredential.password}</code>
          </div>
        </section>
      )}
      <div className="form-grid">
        <div>
          <label>{t.primaryColor}</label>
          <div className="color-input-row">
            <input type="color" value={form.primary_color} onChange={set("primary_color")} />
            <input value={form.primary_color} onChange={set("primary_color")} />
          </div>
        </div>
        <div>
          <label>{t.secondaryColor}</label>
          <div className="color-input-row">
            <input type="color" value={form.secondary_color} onChange={set("secondary_color")} />
            <input value={form.secondary_color} onChange={set("secondary_color")} />
          </div>
        </div>
      </div>
      <label>{t.logo}</label>
      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => onLogoChange(event.target.files?.[0] || null)} />
      <div className="branding-preview onboarding-brand-preview" style={{ background: form.secondary_color, borderColor: form.primary_color }}>
        <strong style={{ color: form.primary_color }}>{instituteName}</strong>
        <span>{t.portalLabel}</span>
      </div>
      <div className="form-actions">
        <button onClick={onSave} disabled={busy}>
          {busy ? t.saving : t.saveBrandingAndReview}
        </button>
      </div>
    </CollapsiblePanel>
  );
}
