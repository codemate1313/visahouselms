import { useEffect, useState } from "react";

const LOGO_SRC = "/assets/visa-house-logo.png";
const VISIBLE_MS = 2600;
const REDUCED_MOTION_MS = 1000;
const FADE_OUT_MS = 450;
const SEEN_STORAGE_KEY = "vh-splash-seen";

function hasSeenSplash(): boolean {
  try {
    return window.localStorage.getItem(SEEN_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markSplashSeen(): void {
  try {
    window.localStorage.setItem(SEEN_STORAGE_KEY, "1");
  } catch {
    // Ignore storage access issues (private browsing, etc.) — splash just replays.
  }
}

export function SplashScreen() {
  const [visible, setVisible] = useState(() => !hasSeenSplash());
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    if (!visible) return;
    markSplashSeen();

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const holdMs = prefersReducedMotion ? REDUCED_MOTION_MS : VISIBLE_MS;

    const holdTimer = window.setTimeout(() => {
      setFadingOut(true);
      window.setTimeout(() => setVisible(false), FADE_OUT_MS);
    }, holdMs);

    return () => window.clearTimeout(holdTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <div className={`app-splash-screen${fadingOut ? " is-fading-out" : ""}`} role="presentation" aria-hidden="true">
      <div className="app-splash-stage">
        <div className="app-splash-glow" />
        <img className="app-splash-logo" src={LOGO_SRC} alt="" />
        <div className="app-splash-shine" />
      </div>
    </div>
  );
}
