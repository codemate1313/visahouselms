import { Link } from "react-router-dom";
import type { AttemptSummary } from "@/api/types";
import { Badge } from "@/components/ui";
import { Icon } from "@/components/icons";
import { formatDateTime } from "@/utils/date";
import { attemptTargetUrl, hasSpeakingRemaining } from "../helpers";
import { studentDashboardStrings as strings } from "../StudentDashboard.strings";

/**
 * Tests the student started and has not finished, with the way back into each.
 *
 * A Final Test whose Speaking section was deferred is the case this exists
 * for: the written paper is closed and saved, nothing is overdue, and the only
 * signal the candidate had was a row in a table on another page. It sits above
 * everything else because an unfinished exam is the most urgent thing on this
 * screen - and it disappears entirely when there is nothing outstanding.
 */
export function UnfinishedTestsPanel({ attempts }: { attempts: AttemptSummary[] }) {
  const t = strings.unfinished;
  const unfinished = attempts.filter(
    (attempt) => attempt.status === "ready" || attempt.status === "in_progress",
  );

  if (!unfinished.length) return null;

  return (
    <section className="workspace-panel sd-unfinished-panel" aria-labelledby="sd-unfinished-title">
      <div className="panel-heading">
        <div>
          <span className="page-eyebrow">{t.eyebrow}</span>
          <h2 id="sd-unfinished-title">{t.heading(unfinished.length)}</h2>
          <p>{t.subtitle}</p>
        </div>
      </div>

      <ul className="sd-unfinished-list">
        {unfinished.map((attempt) => {
          const speakingLeft = hasSpeakingRemaining(attempt);
          return (
            <li key={attempt.id} className="sd-unfinished-row">
              <div className="sd-unfinished-copy">
                <strong>{attempt.module_title}</strong>
                <span>
                  {speakingLeft ? t.speakingLeft : t.inProgress}
                  {attempt.started_at ? ` · ${t.startedAt(formatDateTime(attempt.started_at))}` : ""}
                </span>
              </div>
              <Badge tone={speakingLeft ? "amber" : "info"}>
                {speakingLeft ? t.speakingBadge : t.resumeBadge}
              </Badge>
              <Link className="ui-btn ui-btn-primary ui-btn-sm sd-unfinished-action" to={attemptTargetUrl(attempt)}>
                <span>{speakingLeft ? t.startSpeaking : t.resume}</span>
                <Icon name="arrowRight" className="sd-unfinished-action-icon" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
