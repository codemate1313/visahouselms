/**
 * The PeopleCert PASSPORT WEB A.T.E.S. lockup that heads the Final Test.
 *
 * Drawn in markup rather than shipped as an image so it stays crisp at any
 * zoom and picks up the exam skin's own colours. Only the Final Test renders
 * it - every other attempt keeps the institute/platform brand mark.
 */
export function PeopleCertBrand() {
  return (
    <div className="lc-brand" aria-label="PeopleCert Passport Web A.T.E.S.">
      <div className="lc-brand-wordmark">
        <span className="lc-brand-people">People</span>
        <span className="lc-brand-cert">Cert</span>
      </div>
      <div className="lc-brand-sub">
        <span className="lc-brand-passport">PASSPORT</span>
        <span className="lc-brand-ates">WEB A.T.E.S.</span>
      </div>
    </div>
  );
}

/** The square clock glyph inside the countdown badge. */
export function LcClockIcon() {
  return (
    <svg className="lc-clock-icon" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
      <circle cx="12" cy="12" r="9.25" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 6.75V12l3.4 2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
