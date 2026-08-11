import { instituteMemberFormStrings as strings } from "../InstituteMemberForm.strings";
import { LinkButton } from "@/components/ui";

const SUPER_ADMIN_CONTACT_EMAIL = "support@languagecertpro.com";

interface CapacityLockedViewProps {
  label: string;
  isStudent: boolean;
  limitIsZero: boolean;
  error: string | null;
  onBack: () => void;
}

export function CapacityLockedView({ label, isStudent, limitIsZero, error, onBack }: CapacityLockedViewProps) {
  const t = strings.featureLocked;
  return (
    <div>
      <h1>{strings.addTitle(label)}</h1>
      <section className="feature-lock-stage" aria-labelledby="member-form-lock-title">
        <div className="feature-lock-preview" aria-hidden="true">
          <form className="form-card wide">
            <div className="form-grid">
              <div><label>{strings.fields.firstName}</label><input disabled /></div>
              <div><label>{strings.fields.lastName}</label><input disabled /></div>
            </div>
            <label>{strings.fields.email}</label><input disabled />
            <label>{strings.fields.phoneNumber}</label><input disabled />
          </form>
        </div>
        <div className="feature-lock-card">
          <span className="feature-lock-icon" aria-hidden="true" />
          <span className="page-eyebrow">{t.eyebrow}</span>
          <h2 id="member-form-lock-title">
            {limitIsZero ? t.noSlotsTitle : t.capacityReachedTitle(isStudent)}
          </h2>
          <p>
            {limitIsZero ? t.noSlotsDescription(isStudent) : t.capacityReachedDescription(isStudent)}
          </p>
          {error && <p className="error-text">{error}</p>}
          <div className="feature-lock-actions">
            <LinkButton
              href={`mailto:${SUPER_ADMIN_CONTACT_EMAIL}?subject=Enable%20${isStudent ? "student" : "instructor"}%20feature`}
            >
              {t.contactCta}
            </LinkButton>
            <button type="button" className="secondary-action" onClick={onBack}>{strings.actions.back}</button>
          </div>
          <p className="hint">{t.emailPrefix} {SUPER_ADMIN_CONTACT_EMAIL}</p>
        </div>
      </section>
    </div>
  );
}
