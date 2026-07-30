import type { AttemptSummary } from "@/api/types";
import { DashboardButton } from "@/components/ui";
import { studentDashboardStrings as strings } from "../StudentDashboard.strings";
import { formatAttemptDate, statusLabel, statusTone } from "../helpers";
import { Icon } from "@/components/icons";

interface RecentActivityPanelProps {
  attempts: AttemptSummary[];
}

export function RecentActivityPanel({ attempts }: RecentActivityPanelProps) {
  const t = strings.recentActivity;
  return (
    <section className="workspace-panel">
      <div className="panel-heading">
        <div>
          <h2>{t.heading}</h2>
          <p>{t.description}</p>
        </div>
      </div>
      {attempts.length ? (
        <ul className="activity-list">
          {attempts.slice(0, 6).map((attempt) => (
            <li className="activity-item" data-tone={statusTone(attempt.status)} key={attempt.id}>
              <span className="activity-dot" />
              <div className="activity-body">
                <div className="activity-main">
                  <span className="sd-test-type">{attempt.module_type.replaceAll("_", " ")}</span>
                  <strong>{attempt.module_title}</strong>
                  <small>
                    {formatAttemptDate(attempt)}
                    {attempt.band_label ? ` · ${attempt.band_label}` : ""}
                  </small>
                </div>
                <div className="activity-side">
                  <span className={`status-pill is-${statusTone(attempt.status)}`}>{statusLabel(attempt.status)}</span>
                  {attempt.raw_score && attempt.max_score && (
                    <small>
                      {Number(attempt.raw_score).toFixed(0)} / {Number(attempt.max_score).toFixed(0)}
                    </small>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-message">{t.empty}</p>
      )}
      <DashboardButton to="/student/attempts" variant="secondary" className="panel-cta" rightIcon={<Icon name="arrowRight" />}>
        {t.viewFullHistory}
      </DashboardButton>
    </section>
  );
}
