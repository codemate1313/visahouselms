import type { Attempt } from "@/api/types";
import { formatDateTime } from "@/utils/date";

export interface ReevaluationStatusStrings {
  eyebrow: string;
  heading: string;
  reviewerPrefix: string;
  resolutionHeading: string;
}

interface ReevaluationStatusProps {
  reevaluation: NonNullable<Attempt["reevaluation"]>;
  strings: ReevaluationStatusStrings;
}

export function ReevaluationStatus({ reevaluation, strings: t }: ReevaluationStatusProps) {
  const isResolved = reevaluation.status === "resolved";
  const isRejected = reevaluation.status === "rejected";
  const isInReview = reevaluation.status === "in_review";
  const isPending = reevaluation.status === "pending";

  const statusTone = isResolved ? "resolved" : isRejected ? "rejected" : isInReview ? "in-review" : "pending";
  const statusBadgeText = isResolved
    ? "Review Completed"
    : isRejected
    ? "Decision Finalized"
    : isInReview
    ? "In Review"
    : "Queued for Review";

  const initials = reevaluation.assigned_to_name
    ? reevaluation.assigned_to_name
        .split(" ")
        .map((part) => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "EX";

  return (
    <section className={`reeval-card is-${statusTone}`}>
      {/* Decorative ambient top glow */}
      <div className="reeval-card-glow" aria-hidden="true" />

      {/* Main Header */}
      <div className="reeval-card-header">
        <div className="reeval-header-left">
          <div className="reeval-icon-orb" aria-hidden="true">
            {isResolved && (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            )}
            {isRejected && (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            )}
            {isInReview && (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12h5l2 8 4-16 3 10 3-4h3" />
              </svg>
            )}
            {isPending && (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            )}
          </div>
          <div className="reeval-title-wrap">
            <div className="reeval-eyebrow-row">
              <span className="reeval-eyebrow">{t.eyebrow}</span>
              {reevaluation.created_at && (
                <span className="reeval-meta-date">
                  • Requested {formatDateTime(reevaluation.created_at)}
                </span>
              )}
            </div>
            <h3 className="reeval-heading">{t.heading}</h3>
          </div>
        </div>

        <div className="reeval-header-right">
          <div className={`reeval-status-pill is-${statusTone}`}>
            <span className="reeval-status-dot" aria-hidden="true" />
            <span className="reeval-status-label">{statusBadgeText}</span>
          </div>
        </div>
      </div>

      {/* Content Body */}
      <div className="reeval-card-body">
        {/* Student's reason block */}
        <div className="reeval-request-box">
          <div className="reeval-sub-heading">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>Your Review Note</span>
          </div>
          <p className="reeval-request-text">{reevaluation.reason || "Re-evaluation requested for manual examiner review."}</p>
        </div>

        {/* Instructor Resolution & Feedback Panel */}
        {(reevaluation.resolution_note || reevaluation.assigned_to_name || isResolved || isRejected) && (
          <div className="reeval-resolution-panel">
            <div className="reeval-resolution-top">
              <div className="reeval-reviewer-profile">
                <div className="reeval-reviewer-avatar">
                  <span>{initials}</span>
                </div>
                <div className="reeval-reviewer-meta">
                  <div className="reeval-reviewer-name-row">
                    <span className="reeval-reviewer-name">
                      {reevaluation.assigned_to_name || "Assigned Examiner"}
                    </span>
                    <span className="reeval-reviewer-badge">Certified Instructor</span>
                  </div>
                  <span className="reeval-reviewer-sub">
                    {reevaluation.resolved_at ? `Evaluated on ${formatDateTime(reevaluation.resolved_at)}` : "Official Reviewer"}
                  </span>
                </div>
              </div>
            </div>

            <div className="reeval-resolution-content">
              <div className="reeval-sub-heading is-resolution">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <span>{t.resolutionHeading || "Instructor Decision & Feedback"}</span>
              </div>
              <div className="reeval-resolution-message">
                <p className="reeval-resolution-text">
                  {reevaluation.resolution_note || "The candidate's responses and scoring criteria have been thoroughly re-evaluated by the instructor. Updated marks and criteria feedback are reflected in the analysis."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* If in progress (pending or in_review) without resolution note yet */}
        {(isPending || isInReview) && !reevaluation.resolution_note && (
          <div className="reeval-pending-notice">
            <div className="reeval-pending-pulse" aria-hidden="true" />
            <p>
              {isInReview
                ? "An instructor is currently reviewing your submission against the official CEFR rubrics. Results and notes will be finalized shortly."
                : "Your request is in the instructor grading queue. You will see detailed examiner feedback here once the evaluation is finished."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
