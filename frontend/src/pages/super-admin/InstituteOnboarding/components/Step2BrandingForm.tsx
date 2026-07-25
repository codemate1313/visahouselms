import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { BrandingPreview } from "@/pages/super-admin/InstituteBranding/components/BrandingPreview";
import { instituteOnboardingStrings as strings } from "../InstituteOnboarding.strings";
import { INITIAL } from "../helpers";

interface Step2BrandingFormProps {
  form: typeof INITIAL;
  set: (field: keyof typeof INITIAL) => (event: { target: { value: string } }) => void;
  instituteName: string | undefined;
  logoSrc: string | null;
  adminCredential: { email: string; password: string } | null;
  onLogoChange: (file: File | null) => void;
  busy: boolean;
  onSave: () => void;
}

export function Step2BrandingForm({ form, set, instituteName, logoSrc, adminCredential, onLogoChange, busy, onSave }: Step2BrandingFormProps) {
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
      <BrandingPreview
        primary={form.primary_color}
        secondary={form.secondary_color}
        fontFamily="system-ui"
        headingWeight={700}
        bodyWeight={400}
        logoSrc={logoSrc}
        instituteName={instituteName}
      />
      <div className="form-actions">
        <button onClick={onSave} disabled={busy}>
          {busy ? t.saving : t.saveBrandingAndReview}
        </button>
      </div>
    </CollapsiblePanel>
  );
}
