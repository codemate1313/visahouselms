import { useNavigate } from "react-router-dom";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { formatCurrencyAmount } from "@/utils/currency";
import { instituteOnboardingStrings as strings } from "../InstituteOnboarding.strings";
import type { Onboarding } from "../types";
import { Button, LinkButton } from "@/components/ui";

interface Step3PublishSummaryProps {
  onboarding: Onboarding;
  busy: boolean;
  onPublish: () => void;
}

export function Step3PublishSummary({ onboarding, busy, onPublish }: Step3PublishSummaryProps) {
  const t = strings.step3;
  const navigate = useNavigate();
  const isPublished = onboarding.onboarding_status === "published";
  const statusLabel = isPublished ? t.publishedAndLive : t.draftReady;
  const heroTitle = isPublished ? t.live : t.readyToPublish;
  const agreementAmount = formatCurrencyAmount(onboarding.agreed_amount || 0, onboarding.agreement_currency);
  const paidAmount = formatCurrencyAmount(onboarding.payment?.amount_paid || 0, onboarding.agreement_currency);

  return (
    <CollapsiblePanel
      className="form-card wide publish-summary-card"
      title={heroTitle}
      description={`${agreementAmount} ${t.agreementSuffix} · ${onboarding.payment?.status || "pending"} ${t.paymentSuffix} · ${onboarding.access_duration_days} days ${t.validitySuffix}`}
      badge={<span className={`badge ${isPublished ? "badge-green" : "badge-amber"}`}>{statusLabel}</span>}
    >
      <div className="publish-hero-header">
        <span className={`badge ${isPublished ? "badge-green" : "badge-amber"}`}>{statusLabel}</span>
        <h2 className="publish-hero-title">{heroTitle}</h2>
        <p className="publish-hero-subtitle">
          <strong>{agreementAmount}</strong>{" "}
          {t.agreementSuffix} ·
          <span className="capitalize-text"> {onboarding.payment?.status || "pending"}</span> {t.paymentSuffix} ·
          <strong> {onboarding.access_duration_days} days</strong> {t.validitySuffix}
        </p>
      </div>

      <div className="publish-stats-grid">
        <div className="publish-stat-box">
          <span className="stat-label">{t.stats.studentAllocation}</span>
          <span className="stat-value">{onboarding.student_limit}</span>
        </div>
        <div className="publish-stat-box">
          <span className="stat-label">{t.stats.instructorAllocation}</span>
          <span className="stat-value">{onboarding.staff_limit}</span>
        </div>
        <div className="publish-stat-box">
          <span className="stat-label">{t.stats.assignedTests}</span>
          <span className="stat-value">{t.stats.unlimited}</span>
        </div>
        <div className="publish-stat-box">
          <span className="stat-label">{t.stats.includedCourses}</span>
          <span className="stat-value">{onboarding.course_count}</span>
        </div>
        <div className="publish-stat-box">
          <span className="stat-label">{t.stats.paymentReceived}</span>
          <span className="stat-value">{paidAmount}</span>
        </div>
      </div>

      {onboarding.onboarding_status === "draft" ? (
        <div className="publish-actions-row">
          <Button onClick={onPublish} disabled={busy}>
            {busy ? t.publishing : t.publishInstitute}
          </Button>
        </div>
      ) : (
        <div className="publish-actions-row">
          <LinkButton to={`/super-admin/institutes/${onboarding.id}`}>
            {t.manageInstitute}
          </LinkButton>
          <button type="button" className="secondary-done-btn" onClick={() => navigate("/super-admin/onboarding")}>
            {t.done}
          </button>
        </div>
      )}
    </CollapsiblePanel>
  );
}
