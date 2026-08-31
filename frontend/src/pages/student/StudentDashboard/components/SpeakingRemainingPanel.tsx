import { Link } from "react-router-dom";
import type { AttemptSummary } from "@/api/types";
import { Icon } from "@/components/icons";
import { studentDashboardStrings as strings } from "../StudentDashboard.strings";
import { attemptTargetUrl, formatAttemptDate, statusLabel } from "../helpers";

interface SpeakingRemainingPanelProps {
  attempts: AttemptSummary[];
}

export function SpeakingRemainingPanel({ attempts }: SpeakingRemainingPanelProps) {
  if (!attempts.length) return null;

  const t = strings.speakingRemaining;

  return (
    <section className="workspace-panel speaking-remaining-panel">
      <div className="panel-heading">
        <div>
          <h2>{t.heading}</h2>
          <p>{t.description}</p>
        </div>
        <span className="speaking-remaining-count">{attempts.length}</span>
      </div>

      <div className="speaking-remaining-list">
        {attempts.slice(0, 3).map((attempt) => (
          <article className="speaking-remaining-card" key={attempt.id}>
            <div className="speaking-remaining-icon">
              <Icon name="microphone" />
            </div>
            <div className="speaking-remaining-body">
              <span>{attempt.module_type.replaceAll("_", " ")}</span>
              <strong>{attempt.module_title}</strong>
              <small>
                {formatAttemptDate(attempt)} · {attempt.phase === "speaking" ? t.active : t.pending}
              </small>
            </div>
            <Link to={attemptTargetUrl(attempt)} className="speaking-remaining-action">
              {statusLabel(attempt.status, attempt)}
              <Icon name="arrowRight" />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
