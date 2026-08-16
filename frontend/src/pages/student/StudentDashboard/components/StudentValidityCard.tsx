import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { StudentCurrentPlan } from "@/api/types";
import { Icon } from "@/components/icons";
import { formatDate } from "@/utils/date";
import { studentDashboardStrings as strings } from "../StudentDashboard.strings";

interface StudentValidityCardProps {
  plan: StudentCurrentPlan;
  isInstituteStudent: boolean;
}

export function StudentValidityCard({ plan, isInstituteStudent }: StudentValidityCardProps) {
  const t = strings.validity;
  const isTrial = !isInstituteStudent && (plan.access_type === "trial" || (plan.demo?.state === "active" && !plan.starts_at));
  const isGrace = plan.state === "grace";
  const isExpired = plan.state === "expired" || (plan.demo?.state === "locked" && plan.state !== "active");
  const isActive = (plan.state === "active" || (!isExpired && !isGrace && Boolean(plan.expires_at))) && !isTrial;

  // Calculate days remaining
  let daysRemaining: number | null = null;
  let totalDays = 30;
  let progressPercent = 75;

  if (isTrial && plan.demo?.days_remaining != null) {
    daysRemaining = plan.demo.days_remaining;
    totalDays = plan.demo.duration_days || 7;
    progressPercent = Math.min(100, Math.max(8, (daysRemaining / totalDays) * 100));
  } else if (plan.expires_at) {
    const diffMs = new Date(plan.expires_at).getTime() - Date.now();
    daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    if (plan.starts_at) {
      const totalMs = new Date(plan.expires_at).getTime() - new Date(plan.starts_at).getTime();
      totalDays = Math.max(1, Math.ceil(totalMs / (1000 * 60 * 60 * 24)));
      progressPercent = Math.min(100, Math.max(5, (daysRemaining / totalDays) * 100));
    } else {
      progressPercent = Math.min(100, Math.max(10, (daysRemaining / 30) * 100));
    }
  } else if (isInstituteStudent) {
    progressPercent = 100;
  }

  const isExpiringSoon = daysRemaining != null && daysRemaining <= 5 && daysRemaining > 0;

  // Determine Title, Labels & Colors
  let title = plan.plan?.name || "Standard Student Plan";
  let subtitle = "";
  let badgeTone: "green" | "amber" | "blue" | "red" | "purple" = "green";
  let badgeLabel: string = t.directActiveEyebrow;
  let badgeIcon: "check" | "due" | "building" | "plan" | "lock" = "plan";

  if (isInstituteStudent) {
    title = plan.institute_name || "Enrolled Institute";
    subtitle = plan.institute_name ? t.managedBy(plan.institute_name) : t.instituteEyebrow;
    badgeLabel = isGrace ? t.directGraceEyebrow : t.instituteEyebrow;
    badgeTone = isGrace ? "amber" : "blue";
    badgeIcon = "building";
  } else if (isTrial) {
    title = "Free Trial & Practice Access";
    subtitle = plan.demo ? t.trialNotice(plan.demo.tests_taken, plan.demo.test_limit) : "Limited free practice access.";
    badgeLabel = t.trialEyebrow;
    badgeTone = "purple";
    badgeIcon = "due";
  } else if (isExpired) {
    title = plan.plan?.name || "Membership Plan";
    subtitle = t.expiredNotice;
    badgeLabel = t.expiredEyebrow;
    badgeTone = "red";
    badgeIcon = "lock";
  } else if (isGrace) {
    subtitle = t.graceNotice;
    badgeLabel = t.directGraceEyebrow;
    badgeTone = "amber";
    badgeIcon = "due";
  } else {
    subtitle = plan.plan?.description || "Full access to published IELTS mock tests & study materials.";
    badgeTone = "green";
    badgeIcon = "check";
  }

  // Quotas
  const aiQuota = plan.ai_evaluations;

  // Sleek 48-tick radial clock marks
  const ticks = useMemo(() => {
    return Array.from({ length: 48 }, (_, i) => {
      const angle = (i * 360) / 48;
      const isMajor = i % 4 === 0;
      return { angle, isMajor };
    });
  }, []);

  // Center Metric Text
  const centerMainText = isExpired
    ? "Expired"
    : isInstituteStudent && !plan.expires_at
      ? "Active"
      : daysRemaining != null
        ? `${daysRemaining} ${daysRemaining === 1 ? "Day" : "Days"}`
        : "Active";

  const centerEyebrowText = isTrial ? "Trial Left" : isInstituteStudent ? "Access" : "Validity";

  // Radius = 68, Circumference = 2 * PI * 68 ≈ 427.26
  const arcRadius = 68;
  const arcCircumference = 2 * Math.PI * arcRadius;
  const strokeOffset = isExpired
    ? arcCircumference
    : arcCircumference - (arcCircumference * progressPercent) / 100;

  return (
    <section className={`sd-validity-hero-card tone-${badgeTone}`}>
      <div className="sd-validity-hero-inner">
        {/* Left Side: Plan Info, Badges, Description & Action Buttons */}
        <div className="sd-validity-info-panel">
          <div className="sd-validity-header-row">
            <div className="sd-validity-badges-wrap">
              <span className={`sd-hero-badge badge-${badgeTone}`}>
                <Icon name={badgeIcon} />
                <span>{badgeLabel}</span>
              </span>
              {isActive && daysRemaining != null && (
                <span className={`sd-hero-status-pill ${isExpiringSoon ? "pill-urgent" : "pill-ok"}`}>
                  <span className="sd-status-dot-pulse" />
                  {isExpiringSoon ? t.expiringSoon(daysRemaining) : t.daysRemaining(daysRemaining)}
                </span>
              )}
              {isGrace && (
                <span className="sd-hero-status-pill pill-urgent">
                  <span className="sd-status-dot-pulse" />
                  {t.directGraceEyebrow}
                </span>
              )}
            </div>
          </div>

          <h2 className="sd-hero-plan-title">{title}</h2>
          <p className="sd-hero-plan-desc">{subtitle}</p>

          {/* AI Quotas chips if enabled */}
          {aiQuota && aiQuota.ai_enabled && (
            <div className="sd-hero-quotas-row">
              <div className="sd-hero-quota-chip">
                <Icon name="grading" />
                <span>
                  <strong>{aiQuota.ai_evaluations_left}</strong> AI Evaluations Left
                </span>
              </div>
              <div className="sd-hero-quota-chip muted">
                <Icon name="check" />
                <span>
                  <strong>{aiQuota.ai_evaluations_used}</strong> Used
                </span>
              </div>
            </div>
          )}

          {/* Action CTAs */}
          <div className="sd-hero-actions-bar">
            {isInstituteStudent ? (
              <Link to="/student/my-courses" className="sd-hero-action-btn btn-secondary">
                <span>{t.viewTestsBtn}</span>
                <Icon name="arrowRight" />
              </Link>
            ) : (
              <Link to="/student/courses" className="sd-hero-action-btn btn-primary">
                <Icon name="plan" />
                <span>{isExpired || isGrace ? t.renewBtn : "Explore Test Plans"}</span>
              </Link>
            )}

            <Link to="/student/my-courses" className="sd-hero-sub-action-link">
              <span>View My Tests & Modules</span>
              <Icon name="arrowRight" />
            </Link>
          </div>
        </div>

        {/* Right Side: Simple, Sleek & Modern Radial Dial Gauge */}
        <div className="sd-sleek-dial-container">
          <div className="sd-sleek-dial-wrapper">
            <svg
              className="sd-sleek-dial-svg"
              viewBox="0 0 170 170"
              aria-label={`Validity gauge: ${centerMainText}`}
            >
              <defs>
                <linearGradient id="vhSleekDialGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#b91c2b" />
                  <stop offset="60%" stopColor="#e11d48" />
                  <stop offset="100%" stopColor="#f43f5e" />
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
                stroke="url(#vhSleekDialGradient)"
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
              <span className="sd-sleek-eyebrow">{centerEyebrowText}</span>
              <strong className={`sd-sleek-metric-val ${isExpired ? "text-danger" : isExpiringSoon ? "text-warning" : ""}`}>
                {centerMainText}
              </strong>
              {plan.expires_at && (
                <span className="sd-sleek-expires-note">
                  {formatDate(plan.expires_at)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
