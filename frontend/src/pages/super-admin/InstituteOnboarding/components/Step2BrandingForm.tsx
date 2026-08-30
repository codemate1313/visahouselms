import { useState } from "react";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { BrandingPreview } from "@/pages/super-admin/InstituteBranding/components/BrandingPreview";
import { instituteOnboardingStrings as strings } from "../InstituteOnboarding.strings";
import { INITIAL } from "../helpers";
import { Icon } from "@/components/icons";
import { commonActions } from "@/content/common.strings";
import { Button } from "@/components/ui";

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
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);

  async function copyToClipboard(text: string, isPass: boolean) {
    try {
      await navigator.clipboard.writeText(text);
      if (isPass) {
        setCopiedPass(true);
        setTimeout(() => setCopiedPass(false), 2000);
      } else {
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2000);
      }
    } catch {
      // Fallback if clipboard API fails
    }
  }

  return (
    <CollapsiblePanel className="form-card wide" title={t.title} description={t.description}>
      {adminCredential && (
        <section className="credential-sheet-card">
          <div className="credential-sheet-header">
            <span className="credential-badge-icon">🔑</span>
            <div>
              <h3 className="credential-sheet-title">{t.credentialsHeading}</h3>
              <p className="credential-sheet-hint">{t.credentialsHint}</p>
            </div>
          </div>

          <div className="credential-fields-grid">
            <div className="credential-field-group">
              <span className="credential-label">Admin Email</span>
              <div className="credential-input-box">
                <code className="credential-text">{adminCredential.email}</code>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="credential-copy-btn"
                  onClick={() => copyToClipboard(adminCredential.email, false)}
                  title="Copy email"
                >
                  {copiedEmail ? <><Icon name="check" /> {commonActions.copied}</> : commonActions.copy}
                </Button>
              </div>
            </div>

            <div className="credential-field-group">
              <span className="credential-label">Temporary Password</span>
              <div className="credential-input-box highlight-pass">
                <code className="credential-text font-mono bold">{adminCredential.password}</code>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="credential-copy-btn"
                  onClick={() => copyToClipboard(adminCredential.password, true)}
                  title="Copy password"
                >
                  {copiedPass ? <><Icon name="check" /> {commonActions.copied}</> : commonActions.copy}
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="form-grid" style={{ marginTop: 24 }}>
        <div>
          <label>{t.primaryColor}</label>
          <div className="color-input-row">
            <input type="color" value={form.primary_color} onChange={set("primary_color")} />
            <input value={form.primary_color} onChange={set("primary_color")} placeholder="#e11d2e" />
          </div>
        </div>
        <div>
          <label>{t.secondaryColor}</label>
          <div className="color-input-row">
            <input type="color" value={form.secondary_color} onChange={set("secondary_color")} />
            <input value={form.secondary_color} onChange={set("secondary_color")} placeholder="#0f172a" />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, marginBottom: 20 }}>
        <label>{t.logo}</label>
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => onLogoChange(event.target.files?.[0] || null)} />
      </div>

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
        <Button onClick={onSave} disabled={busy} loading={busy}>
          {busy ? t.saving : t.saveBrandingAndReview}
        </Button>
      </div>
    </CollapsiblePanel>
  );
}
