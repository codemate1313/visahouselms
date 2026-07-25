import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import type { StudentLeaderboard } from "@/api/types";
import { studentProgressStrings as strings } from "../StudentProgress.strings";

interface LeaderboardPanelProps {
  leaderboard: StudentLeaderboard;
}

export function LeaderboardPanel({ leaderboard }: LeaderboardPanelProps) {
  const t = strings.leaderboard;
  return (
    <CollapsiblePanel
      className="progress-section"
      title={t.title}
      description={t.description}
      badge={<span className="count-chip">{leaderboard.entries.length}</span>}
    >
      {leaderboard.message ? (
        <p className="empty-message">{leaderboard.message}</p>
      ) : leaderboard.entries.length ? (
        <div className="table-wrap">
          <table className="data-table leaderboard-table">
            <thead>
              <tr>
                <th>{t.rank}</th>
                <th>{t.student}</th>
                <th>{t.tests}</th>
                <th>{t.average}</th>
                <th>{t.bestCefr}</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.entries.map((entry) => (
                <tr key={entry.user_id} className={entry.is_current_student ? "is-current-student" : ""}>
                  <td>
                    <strong>#{entry.rank}</strong>
                  </td>
                  <td>
                    {entry.display_name}
                    {entry.is_current_student && <span className="you-label">{t.you}</span>}
                  </td>
                  <td>{entry.attempts_count}</td>
                  <td>{entry.average_percentage}%</td>
                  <td>
                    <span className="badge badge-gray">{entry.best_cefr_level ?? "-"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty-message">{t.empty}</p>
      )}
    </CollapsiblePanel>
  );
}
