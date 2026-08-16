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
  if (isTrial && plan.demo?.days_remaining != null) {
    daysRemaining = plan.demo.days_remaining;
  } else if (plan.expires_at) {
    const diffMs = new Date(plan.expires_at).getTime() - Date.now();
    daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  const isExpiringSoon = daysRemaining != null && daysRemaining <= 5 && daysRemaining > 0;

  // Determine Title & Subtitle
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
    subtitle = plan.plan?.description || "Access to all published mock tests and practice materials.";
    badgeTone = "green";
    badgeIcon = "check";
  }

  // Quotas
  const aiQuota = plan.ai_evaluations;

  return (
    <section className={`sd-validity-card tone-${badgeTone}`}>
      <div className="sd-validity-main">
        {/* Left identity & details */}
        <div className="sd-validity-identity">
          <div className="sd-validity-badges">
            <span className={`sd-validity-badge badge-${badgeTone}`}>
              <Icon name={badgeIcon} />
              <span>{badgeLabel}</span>
            </span>
            {isActive && daysRemaining != null && (
              <span className={`sd-status-pill ${isExpiringSoon ? "pill-urgent" : "pill-ok"}`}>
                <span className="sd-status-dot" />
                {isExpiringSoon ? t.expiringSoon(daysRemaining) : t.daysRemaining(daysRemaining)}
              </span>
            )}
            {isGrace && (
              <span className="sd-status-pill pill-urgent">
                <span className="sd-status-dot" />
                {t.directGraceEyebrow}
              </span>
            )}
            {isTrial && daysRemaining != null && (
              <span className={`sd-status-pill ${daysRemaining <= 2 ? "pill-urgent" : "pill-ok"}`}>
                <span className="sd-status-dot" />
                {t.daysRemaining(daysRemaining)}
              </span>
            )}
          </div>

          <h2 className="sd-validity-title">{title}</h2>
          <p className="sd-validity-desc">{subtitle}</p>

          {/* AI Quotas if available */}
          {aiQuota && aiQuota.ai_enabled && (
            <div className="sd-validity-quotas">
              <span className="sd-quota-chip">
                <Icon name="grading" />
                <strong>{aiQuota.ai_evaluations_left}</strong> AI Evaluations Remaining
              </span>
              <span className="sd-quota-chip">
                <Icon name="check" />
                <strong>{aiQuota.ai_evaluations_used}</strong> Evaluations Used
              </span>
            </div>
          )}
        </div>

        {/* Right validity dates and action CTA */}
        <div className="sd-validity-dates-box">
          <div className="sd-date-metrics-grid">
            <div className="sd-date-metric">
              <span className="sd-date-label">
                <Icon name="due" />
                <span>{t.validFrom}</span>
              </span>
              <strong className="sd-date-value">
                {formatDate(plan.starts_at || (plan.demo?.days_remaining != null ? plan.starts_at : null))}
              </strong>
            </div>

            <div className="sd-date-metric">
              <span className="sd-date-label">
                <Icon name="due" />
                <span>{t.validUntil}</span>
              </span>
              <strong className={`sd-date-value ${isExpired ? "text-danger" : isExpiringSoon ? "text-warning" : ""}`}>
                {plan.expires_at ? formatDate(plan.expires_at) : isInstituteStudent ? t.ongoingAccess : "—"}
              </strong>
            </div>
          </div>

          <div className="sd-validity-actions">
            {isInstituteStudent ? (
              <Link to="/student/my-courses" className="sd-validity-cta-btn btn-secondary">
                <span>{t.viewTestsBtn}</span>
                <Icon name="arrowRight" />
              </Link>
            ) : isExpired || isGrace ? (
              <Link to="/student/course-catalog" className="sd-validity-cta-btn btn-primary">
                <Icon name="plan" />
                <span>{t.renewBtn}</span>
              </Link>
            ) : isTrial ? (
              <Link to="/student/course-catalog" className="sd-validity-cta-btn btn-primary">
                <Icon name="plan" />
                <span>{t.exploreBtn}</span>
              </Link>
            ) : (
              <Link to="/student/course-catalog" className="sd-validity-cta-btn btn-outline">
                <span>{t.renewBtn}</span>
                <Icon name="arrowRight" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
