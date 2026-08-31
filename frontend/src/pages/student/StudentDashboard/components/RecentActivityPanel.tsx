import { Link } from "react-router-dom";
import type { AttemptSummary } from "@/api/types";
import { DashboardButton } from "@/components/ui";
import { studentDashboardStrings as strings } from "../StudentDashboard.strings";
import { attemptTargetUrl, formatAttemptDate, statusLabel, statusTone } from "../helpers";
import { Icon } from "@/components/icons";

interface RecentActivityPanelProps {
  attempts: AttemptSummary[];
}

export function RecentActivityPanel({ attempts }: RecentActivityPanelProps) {
  const t = strings.recentActivity;

  return (
    <section className="workspace-panel recent-activity-panel">
      <div className="panel-heading">
        <div>
          <h2>{t.heading}</h2>
          <p>{t.description}</p>
        </div>
      </div>
      {attempts.length ? (
        <ul className="activity-list">
          {attempts.slice(0, 5).map((attempt) => {
            const hasScore =
              attempt.raw_score !== null &&
              attempt.raw_score !== undefined &&
              attempt.max_score !== null &&
              attempt.max_score !== undefined &&
              Number(attempt.max_score) > 0;

            return (
              <li className="activity-item" data-tone={statusTone(attempt.status)} key={attempt.id}>
                <Link
                  to={attemptTargetUrl(attempt)}
                  className="activity-item-card"
                >
                  <div className="activity-card-header">
                    <span className="sd-test-type">
                      {attempt.module_type.replaceAll("_", " ")}
                    </span>
                    <span className={`status-pill is-${statusTone(attempt.status)}`}>
                      <span className="status-pill-dot" />
                      {statusLabel(attempt.status)}
                    </span>
                  </div>

                  <div className="activity-card-main">
                    <div className="activity-card-info">
                      <strong className="activity-card-title">{attempt.module_title}</strong>
                      <div className="activity-card-meta">
                        <span>{formatAttemptDate(attempt)}</span>
                        {attempt.band_label && (
                          <>
                            <span className="meta-separator">•</span>
                            <span className="activity-band-pill">{attempt.band_label}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {hasScore && (
                      <div className="activity-score-box">
                        <span className="activity-score-val">{Number(attempt.raw_score).toFixed(0)}</span>
                        <span className="activity-score-sep">/</span>
                        <span className="activity-score-max">{Number(attempt.max_score).toFixed(0)}</span>
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty-message">{t.empty}</p>
      )}
      <div className="panel-cta-container">
        <DashboardButton
          to="/student/attempts"
          variant="secondary"
          className="panel-cta-full"
          rightIcon={<Icon name="arrowRight" />}
        >
          {t.viewFullHistory}
        </DashboardButton>
      </div>
    </section>
  );
}
