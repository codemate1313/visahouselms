import { useState, type CSSProperties } from "react";
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
  const [previewTheme, setPreviewTheme] = useState<"light" | "dark">(() => {
    if (typeof document === "undefined") {
      return "light";
    }

    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  });

  return (
    <div
      className="branding-dashboard-preview"
      data-preview-theme={previewTheme}
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
          <div className="branding-preview-header-actions">
            <button
              type="button"
              className="branding-preview-theme-btn"
              onClick={() => setPreviewTheme(previewTheme === "light" ? "dark" : "light")}
              title={previewTheme === "light" ? "Switch preview to Dark mode" : "Switch preview to Light mode"}
              aria-label="Toggle preview theme"
            >
              {previewTheme === "light" ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
            <button className="branding-preview-button">{t.viewAssignedTests}</button>
          </div>
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
