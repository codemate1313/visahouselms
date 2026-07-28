import { Link } from "react-router-dom";
import type { AttemptSummary } from "@/api/types";
import { studentDashboardStrings as strings } from "../StudentDashboard.strings";
import { formatAttemptDate, statusLabel, statusTone } from "../helpers";
import { Icon } from "@/components/icons";

interface RecentActivityPanelProps {
  attempts: AttemptSummary[];
}

export function RecentActivityPanel({ attempts }: RecentActivityPanelProps) {
  const t = strings.recentActivity;
  return (
    <section className="sd-panel">
      <div className="sd-panel-head">
        <div>
          <h2>{t.heading}</h2>
          <p>{t.description}</p>
        </div>
      </div>
      {attempts.length ? (
        <ul className="sd-activity-list">
          {attempts.slice(0, 6).map((attempt) => (
            <li className="sd-activity-item" data-tone={statusTone(attempt.status)} key={attempt.id}>
              <span className="sd-activity-dot" />
              <div className="sd-activity-body">
                <div className="sd-activity-main">
                  <span className="sd-test-type">{attempt.module_type.replaceAll("_", " ")}</span>
                  <strong>{attempt.module_title}</strong>
                  <small>
                    {formatAttemptDate(attempt)}
                    {attempt.band_label ? ` · ${attempt.band_label}` : ""}
                  </small>
                </div>
                <div className="sd-activity-side">
                  <span className={`sd-status-pill is-${statusTone(attempt.status)}`}>{statusLabel(attempt.status)}</span>
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
        <p className="sd-empty">{t.empty}</p>
      )}
      <Link className="sd-panel-link" to="/student/attempts">
        {t.viewFullHistory} <Icon name="arrowRight" />
      </Link>
    </section>
  );
}
