import { subscriptionsStrings as strings } from "../Subscriptions.strings";
import { STATE_BADGES, stateLabel } from "../helpers";

interface ValidityGaugeProps {
  daysRemaining: number | null;
  state: string;
}

export function ValidityGauge({ daysRemaining, state }: ValidityGaugeProps) {
  const t = strings.validityGauge;
  const days = daysRemaining ?? 0;
  const maxDays = 365;
  const percent = Math.min(100, Math.max(0, Math.round((days / maxDays) * 100)));
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  const strokeColor =
    state === "active"
      ? "var(--green-600)"
      : state === "grace"
        ? "var(--amber-600)"
        : state === "scheduled"
          ? "var(--slate-500)"
          : "var(--danger)";

  const description =
    state === "active"
      ? t.activeDescription
      : state === "grace"
        ? t.graceDescription
        : state === "scheduled"
          ? t.scheduledDescription
          : t.expiredDescription;

  return (
    <div className="validity-gauge-card">
      <h3 className="analytics-card-title">{t.title}</h3>
      <div className="gauge-row">
        <div className="gauge-chart-wrap">
          <svg width="90" height="90" viewBox="0 0 90 90" className="gauge-svg">
            <circle cx="45" cy="45" r={radius} className="gauge-bg" />
            <circle cx="45" cy="45" r={radius} className="gauge-fill" stroke={strokeColor} strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} />
          </svg>
          <div className="gauge-center-text">
            <span className="gauge-days">{days}</span>
            <span className="gauge-label">{t.days}</span>
          </div>
        </div>
        <div className="gauge-info-text">
          <span className={`badge ${STATE_BADGES[state]}`} style={{ width: "max-content", marginBottom: 6 }}>
            {stateLabel(state)}
          </span>
          <p className="gauge-desc">{description}</p>
        </div>
      </div>
    </div>
  );
}
