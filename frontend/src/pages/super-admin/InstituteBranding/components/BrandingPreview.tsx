import type { CSSProperties } from "react";
import { instituteBrandingStrings as strings } from "../InstituteBranding.strings";

interface BrandingPreviewProps {
  primary: string;
  secondary: string;
  fontFamily: string;
  headingWeight: number;
  bodyWeight: number;
  logoSrc: string | null;
  instituteName: string | undefined;
}

export function BrandingPreview({ primary, secondary, fontFamily, headingWeight, bodyWeight, logoSrc, instituteName }: BrandingPreviewProps) {
  const t = strings.preview;
  return (
    <div
      className="branding-dashboard-preview"
      style={{
        "--preview-primary": primary,
        "--preview-secondary": secondary,
        "--preview-on-primary": "var(--white)",
        fontFamily: fontFamily === "system-ui" ? "system-ui" : `'${fontFamily}', sans-serif`,
        fontWeight: bodyWeight,
      } as CSSProperties}
    >
      <div className="branding-preview-sidebar">
        <div className="branding-preview-brand">
          {logoSrc ? <img src={logoSrc} alt="" className="branding-preview-logo" /> : <div className="branding-preview-logo-placeholder" />}
          <div>
            <strong style={{ fontWeight: headingWeight }}>{instituteName ?? t.defaultInstituteName}</strong>
            <span>{t.instituteStudent}</span>
          </div>
        </div>
        <div className="branding-preview-menu">
          <span className="is-active">{t.dashboard}</span>
          <span>{t.myTests}</span>
          <span>{t.myTestHistory}</span>
          <span>{t.progress}</span>
        </div>
        <div className="branding-preview-settings">
          <span>{t.myProfile}</span>
          <span>{t.activeSessions}</span>
        </div>
      </div>
      <div className="branding-preview-main">
        <div className="branding-preview-header">
          <div>
            <small>{t.portalLabel}</small>
            <h3 style={{ fontWeight: headingWeight }}>{t.welcome}</h3>
            <p>{t.description}</p>
          </div>
          <button className="branding-preview-button">{t.viewAssignedTests}</button>
        </div>
        <div className="branding-preview-stats">
          <article>
            <span>{t.stats.availableTests}</span>
            <strong>6</strong>
          </article>
          <article>
            <span>{t.stats.inProgress}</span>
            <strong>0</strong>
          </article>
          <article>
            <span>{t.stats.awaitingGrading}</span>
            <strong>12</strong>
          </article>
          <article>
            <span>{t.stats.graded}</span>
            <strong>1</strong>
          </article>
        </div>
        <div className="branding-preview-panels">
          <section>
            <h4>{t.assignedTestsHeading}</h4>
            <p>{t.assignedTestsDescription}</p>
            <div className="branding-preview-panel-row">
              <span>{t.availableNow}</span>
              <strong>6 {t.testsCountSuffix}</strong>
            </div>
            <button className="branding-preview-text-button">{t.goToMyTests}</button>
          </section>
          <section>
            <h4>{t.recentActivityHeading}</h4>
            {t.sampleActivities.map((item) => (
              <div className="branding-preview-activity" key={item}>
                <span>{item}</span>
                <small>{t.awaitingGradingLabel}</small>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
