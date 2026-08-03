import { Link } from "react-router-dom";
import { instituteMembersStrings as strings } from "../InstituteMembers.strings";
import { Badge, LinkButton } from "@/components/ui";

const SUPER_ADMIN_CONTACT_EMAIL = "support@ieltslmspro.com";

interface MembersFeatureLockedProps {
  canViewBilling: boolean | undefined;
}

export function MembersFeatureLocked({ canViewBilling }: MembersFeatureLockedProps) {
  const t = strings.featureLocked;
  return (
    <section className="feature-lock-stage" aria-labelledby="instructor-feature-lock-title">
      <div className="feature-lock-preview" aria-hidden="true">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{strings.table.name}</th>
                <th>{strings.table.email}</th>
                <th>{strings.table.contact}</th>
                <th>{strings.table.status}</th>
                <th>{strings.table.created}</th>
                <th className="table-actions-heading">{strings.table.actions}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>Instructor access</strong>
                </td>
                <td>locked@example.com</td>
                <td>-</td>
                <td>
                  <Badge tone="gray">Locked</Badge>
                </td>
                <td>-</td>
                <td />
              </tr>
              <tr>
                <td>
                  <strong>Feature unavailable</strong>
                </td>
                <td>contact-admin@example.com</td>
                <td>-</td>
                <td>
                  <Badge tone="gray">Locked</Badge>
                </td>
                <td>-</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="feature-lock-card">
        <span className="feature-lock-icon" aria-hidden="true" />
        <span className="page-eyebrow">{t.eyebrow}</span>
        <h2 id="instructor-feature-lock-title">{t.title}</h2>
        <p>{t.description}</p>
        <div className="feature-lock-actions">
          <LinkButton href={`mailto:${SUPER_ADMIN_CONTACT_EMAIL}?subject=Enable%20instructor%20feature`}>
            {t.contactCta}
          </LinkButton>
          {canViewBilling && (
            <Link className="secondary-action link-action" to="/institute-portal/billing">
              {t.viewSubscription}
            </Link>
          )}
        </div>
        <p className="hint">
          {t.emailPrefix} {SUPER_ADMIN_CONTACT_EMAIL}
        </p>
      </div>
    </section>
  );
}
