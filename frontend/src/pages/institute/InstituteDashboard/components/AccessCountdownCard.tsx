import { useEffect, useMemo, useState } from "react";
import { instituteDashboardStrings as strings } from "../InstituteDashboard.strings";
import type { AccessWindow } from "../types";
import { DashboardButton } from "@/components/ui";
import { formatDate } from "@/utils/date";

interface AccessCountdownCardProps {
  access: AccessWindow;
  canSeeBilling: boolean;
}

const URGENT_SECONDS = 7 * 24 * 60 * 60;

/** Counts down to the moment the institute loses access (plan expiry plus its
 *  grace days) and spells out that every downline account goes with it. The
 *  countdown starts from the server's seconds_remaining rather than the local
 *  clock, so a skewed device cannot show a deadline that has not arrived. */
export function AccessCountdownCard({ access, canSeeBilling }: AccessCountdownCardProps) {
  const t = strings.accessCountdown;
  const [secondsLeft, setSecondsLeft] = useState(access.seconds_remaining ?? 0);

  useEffect(() => {
    setSecondsLeft(access.seconds_remaining ?? 0);
  }, [access.seconds_remaining]);

  useEffect(() => {
    if (access.seconds_remaining === null) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((previous) => Math.max(0, previous - 60));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [access.seconds_remaining]);

  // Sleek 48-tick radial clock marks
  const ticks = useMemo(() => {
    return Array.from({ length: 48 }, (_, i) => {
      const angle = (i * 360) / 48;
      const isMajor = i % 4 === 0;
      return { angle, isMajor };
    });
  }, []);

  if (access.access_ends_at === null) return null;

  const ended = secondsLeft <= 0 || access.state === "expired" || access.institute_suspended;
  const tone = ended ? "danger" : secondsLeft <= URGENT_SECONDS || access.state === "grace" ? "warning" : "calm";

  const days = Math.floor(secondsLeft / 86400);
  const hours = Math.floor((secondsLeft % 86400) / 3600);
  const deadline = formatDate(access.access_ends_at);

  // Calculate Progress Percentage for the radial gauge
  let progressPercent = 100;
  if (secondsLeft > 0) {
    if (days > 90) {
      progressPercent = Math.min(100, Math.max(10, (days / 365) * 100));
    } else if (days > 30) {
      progressPercent = Math.min(100, Math.max(10, (days / 90) * 100));
    } else {
      progressPercent = Math.min(100, Math.max(10, (days / 30) * 100));
    }
  } else {
    progressPercent = 0;
  }

  // Central Typography Texts
  const centerEyebrowText = ended
    ? "Status"
    : access.state === "grace"
      ? "Grace Period"
      : "Active Left";

  const centerMainText = ended
    ? "Expired"
    : days > 0
      ? `${days} ${days === 1 ? "Day" : "Days"}`
      : `${hours}h`;

  // Radius = 68, Circumference = 2 * PI * 68 ≈ 427.26
  const arcRadius = 68;
  const arcCircumference = 2 * Math.PI * arcRadius;
  const strokeOffset = ended
    ? arcCircumference
    : arcCircumference - (arcCircumference * progressPercent) / 100;

  return (
    <div className={`access-countdown-card is-${tone}`} role="alert">
      {/* Sleek Radial Dial Gauge (replacing default text countdown meter) */}
      <div className="sd-sleek-dial-container" style={{ paddingRight: "18px", borderRight: "1px solid var(--border)" }}>
        <div className="sd-sleek-dial-wrapper">
          <svg
            className="sd-sleek-dial-svg"
            viewBox="0 0 170 170"
            aria-label={`Access time left gauge: ${centerMainText}`}
          >
            <defs>
              <linearGradient id="vhAccessDialGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--primary)" />
                <stop offset="60%" stopColor="color-mix(in srgb, var(--primary) 85%, white)" />
                <stop offset="100%" stopColor="color-mix(in srgb, var(--primary) 70%, white)" />
              </linearGradient>
            </defs>

            {/* Background Outer Ring */}
            <circle
              cx="85"
              cy="85"
              r={arcRadius}
              fill="none"
              stroke="rgba(0, 0, 0, 0.05)"
              strokeWidth="10"
            />

            {/* Active Animated Progress Arc */}
            <circle
              cx="85"
              cy="85"
              r={arcRadius}
              fill="none"
              stroke="url(#vhAccessDialGradient)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={arcCircumference}
              strokeDashoffset={strokeOffset}
              transform="rotate(-90 85 85)"
              className="sd-sleek-gauge-arc"
            />

            {/* Sleek Radial Dial Ticks */}
            <g transform="translate(85, 85)" className="sd-sleek-ticks-group">
              {ticks.map(({ angle, isMajor }, i) => (
                <line
                  key={i}
                  x1="0"
                  y1={isMajor ? "-56" : "-54"}
                  x2="0"
                  y2="-48"
                  transform={`rotate(${angle})`}
                  stroke={isMajor ? "var(--slate-700, #334155)" : "var(--slate-400, #94a3b8)"}
                  strokeWidth={isMajor ? "1.6" : "1"}
                  strokeLinecap="round"
                  opacity={isMajor ? "0.75" : "0.35"}
                />
              ))}
            </g>

            {/* Center Pure White Disc */}
            <circle
              cx="85"
              cy="85"
              r="50"
              fill="var(--surface, #ffffff)"
              className="sd-sleek-center-circle"
            />
          </svg>

          {/* Central Typography */}
          <div className="sd-sleek-center-text-wrap">
            <span className="sd-sleek-eyebrow" style={{ fontSize: "7.5px" }}>{centerEyebrowText}</span>
            <strong className={`sd-sleek-metric-val ${ended ? "text-danger" : tone === "warning" ? "text-warning" : ""}`} style={{ fontSize: "12px" }}>
              {centerMainText}
            </strong>
            <span className="sd-sleek-expires-note" style={{ fontSize: "7.5px" }}>
              {ended ? "Suspended" : deadline}
            </span>
          </div>
        </div>
      </div>

      <div className="access-countdown-body">
        <span className="access-countdown-plan">{t.plan(access.plan_name)}</span>
        <p className="access-countdown-warning">{ended ? t.endedWarning : t.warning}</p>
        {!ended && access.grace_days > 0 && <p className="access-countdown-note">{t.graceNote(access.grace_days)}</p>}
        {canSeeBilling && (
          <DashboardButton to="/institute-portal/billing">
            {t.renew}
          </DashboardButton>
        )}
      </div>
    </div>
  );
}
