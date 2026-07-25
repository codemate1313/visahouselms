import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { RequiredMark } from "@/components/ui";
import { instituteOnboardingStrings as strings } from "../InstituteOnboarding.strings";
import { INITIAL } from "../helpers";

interface InstituteAdminDetailsPanelProps {
  form: typeof INITIAL;
  set: (field: keyof typeof INITIAL) => (event: { target: { value: string } }) => void;
}

export function InstituteAdminDetailsPanel({ form, set }: InstituteAdminDetailsPanelProps) {
  const t = strings.step1.instituteAdminDetails;
  return (
    <CollapsiblePanel className="form-card onboarding-section-card" title={t.title} description={t.description}>
      <div className="form-grid">
        <div>
          <label htmlFor="ob-name">{t.instituteName}<RequiredMark /></label>
          <input id="ob-name" value={form.name} onChange={set("name")} required placeholder={t.instituteNamePlaceholder} />
        </div>
        <div>
          <label htmlFor="ob-contact">{t.contactEmail}</label>
          <input id="ob-contact" type="email" value={form.contact_email} onChange={set("contact_email")} placeholder={t.contactEmailPlaceholder} />
        </div>
      </div>

      <h3 className="section-subheading" style={{ marginTop: 20 }}>
        {t.firstAdminHeading}
      </h3>
      <div className="form-grid">
        <div>
          <label>{t.adminEmail}<RequiredMark /></label>
          <input type="email" value={form.admin_email} onChange={set("admin_email")} required placeholder={t.adminEmailPlaceholder} />
        </div>
        <div>
          <label>{t.firstName}<RequiredMark /></label>
          <input value={form.admin_first_name} onChange={set("admin_first_name")} required placeholder={t.firstNamePlaceholder} />
        </div>
        <div>
          <label>{t.lastName}<RequiredMark /></label>
          <input value={form.admin_last_name} onChange={set("admin_last_name")} required placeholder={t.lastNamePlaceholder} />
        </div>
      </div>
    </CollapsiblePanel>
  );
}
