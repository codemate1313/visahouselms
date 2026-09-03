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
      <div className="lc-brand-main">
        <LanguageCertLogo />
        <div className="lc-brand-wordmark">
          <span className="lc-brand-people">People</span>
          <span className="lc-brand-cert">Cert</span>
        </div>
      </div>
      <div className="lc-brand-sub">
        <span className="lc-brand-passport">PASSPORT</span>
        <span className="lc-brand-ates">WEB A.T.E.S.</span>
      </div>
    </div>
  );
}

/**
 * The LanguageCert speech-bubble mark.
 *
 * Reproduced as an inline SVG from the official logo: a red filled speech
 * bubble with a white crescent and dot cutout forming the "LC" letterform.
 * Rendered at a fixed 36 px height so it sits comfortably beside the timer
 * in the final-test header without disturbing the 48 px row height.
 */
export function LanguageCertLogo() {
  return (
    <svg
      className="lc-languagecert-logo"
      viewBox="29 32 134 115"
      width="44"
      height="38"
      aria-label="LanguageCert"
      role="img"
      focusable="false"
    >
      <path
        fill="#EE3024"
        fillRule="evenodd"
        d="
          M 161.5 144
          C 151.5 142.8 144.0 138.0 139.2 132.2
          C 136.0 128.3 133.7 125.1 132.0 122.7
          C 128.0 136.0 112.0 145.0 91.0 145.0
          C 57.0 145.0 31.0 121.0 31.0 90.0
          C 31.0 58.0 56.0 34.0 89.0 34.0
          C 123.0 34.0 148.0 57.0 149.0 88.0
          C 149.4 99.0 147.0 108.0 146.0 115.0
          C 145.0 128.0 150.0 138.0 161.5 144.0
          Z

          M 99.0 66.0
          C 113.0 66.0 123.0 76.8 123.0 90.5
          C 123.0 105.2 114.5 117.8 104.0 123.3
          C 100.8 125.0 97.2 124.8 93.8 122.8
          C 84.0 117.0 78.0 106.5 78.0 93.0
          C 78.0 79.5 86.0 68.8 99.0 66.0
          Z

          M 85.0 48.5
          C 68.0 53.0 54.5 68.5 53.0 87.0
          C 51.5 106.0 63.0 121.5 82.0 128.0
          C 85.0 129.0 88.0 130.0 91.0 130.5
          C 72.5 121.0 61.5 108.0 61.5 90.0
          C 61.5 71.5 70.0 57.5 85.0 48.5
          Z
        "
      />
    </svg>
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

/**
 * The outline flag that sits beside every part in the exam rail.
 *
 * Presentational only. On the delivery platform this is the candidate's
 * mark-for-review control; nothing in this runner stores that state, so it is
 * drawn as decoration and hidden from assistive tech rather than shipped as a
 * button that would look operable and do nothing.
 */
export function LcFlagIcon() {
  return (
    <svg
      className="lc-rail-flag"
      viewBox="0 0 16 16"
      width="16"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4.05 1.7v12.6" strokeLinecap="round" />
      <path d="M4.05 2.5h8.5l-2.05 2.65 2.05 2.65h-8.5z" strokeLinejoin="round" />
    </svg>
  );
}
