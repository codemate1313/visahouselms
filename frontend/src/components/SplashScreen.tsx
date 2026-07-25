import { useEffect, useState } from "react";
import "./SplashScreen.css";

const SPLASH_DURATION_MS = 3600;

export function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const exitTimer = window.setTimeout(() => setLeaving(true), SPLASH_DURATION_MS - 520);
    const removeTimer = window.setTimeout(() => setVisible(false), SPLASH_DURATION_MS);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={`vh-splash${leaving ? " is-leaving" : ""}`} aria-hidden="true">
      <div className="vh-splash-glow" />
      <div className="vh-splash-orbit vh-splash-orbit-black" />
      <div className="vh-splash-orbit vh-splash-orbit-red" />
      <div className="vh-splash-globe">
        <span className="vh-splash-map vh-splash-map-one" />
        <span className="vh-splash-map vh-splash-map-two" />
        <span className="vh-splash-map vh-splash-map-three" />
      </div>
      <img
        className="vh-splash-logo"
        src="/brand/visa-house-round-logo.png"
        alt=""
        draggable="false"
      />
      <div className="vh-splash-shadow" />
    </div>
  );
}
