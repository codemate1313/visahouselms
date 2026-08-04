import { PageHeader } from "@/components/ui";
import { RenewPlanCard } from "../InstituteBilling/components/RenewPlanCard";
import { instituteSetupStrings as strings } from "./InstituteSetup.strings";

/**
 * First-run setup for an institute that has just been approved.
 *
 * Only one thing belongs here: buying a term. Until that happens the institute
 * has no seats, so there is nobody to show a logo to and nothing for branding
 * to apply to - it lives in the portal proper, once there is a portal to brand.
 *
 * The plan card is the same one the billing page renews from; the server
 * already reports this institute as needing activation rather than renewal.
 */
export function InstituteSetup() {
  return (
    <div className="institute-setup">
      <PageHeader eyebrow={strings.eyebrow} title={strings.title} subtitle={strings.subtitle} />

      {/* Once this succeeds the institute has a live term, so the setup guard
          stops matching and the normal portal takes over on reload. */}
      <RenewPlanCard onRenewed={() => window.location.assign("/institute-portal/dashboard")} />

      <section className="form-card wide setup-next-steps">
        <h2>{strings.afterPayment.heading}</h2>
        <ul>
          {strings.afterPayment.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
