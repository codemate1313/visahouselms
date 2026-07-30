import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import type { StudentLeaderboard } from "@/api/types";
import { SegmentedControl } from "@/components/ui";
import { studentProgressStrings as strings } from "../StudentProgress.strings";

interface LeaderboardPanelProps {
  leaderboard: StudentLeaderboard;
  scope: "institute" | "global";
  onScopeChange: (scope: "institute" | "global") => void;
}

export function LeaderboardPanel({ leaderboard, scope, onScopeChange }: LeaderboardPanelProps) {
  const t = strings.leaderboard;

  const top1 = leaderboard.entries.find((e) => e.rank === 1);
  const top2 = leaderboard.entries.find((e) => e.rank === 2);
  const top3 = leaderboard.entries.find((e) => e.rank === 3);

  return (
    <CollapsiblePanel
      className="progress-section"
      title={scope === "global" ? "Global leaderboard" : t.title}
      description={t.description}
      badge={<span className="count-chip">{leaderboard.entries.length}</span>}
    >
      <SegmentedControl
        ariaLabel="Leaderboard scope"
        className="leaderboard-scope-tabs"
        onChange={onScopeChange}
        options={[
          { label: "Institute Cohort", value: "institute" },
          { label: "Global Standings", value: "global" },
        ]}
        value={scope}
      />

      {leaderboard.message ? (
        <p className="empty-message">{leaderboard.message}</p>
      ) : leaderboard.entries.length ? (
        <>
          {/* 3D Visual Score Podium */}
          <div className="leaderboard-podium">
            {/* Rank 2 (Silver) */}
            <div className={`podium-col second ${!top2 ? "empty-pedestal" : ""}`}>
              {top2 ? (
                <>
                  <div className="podium-info">
                    <div className="podium-name">
                      {top2.display_name}
                      {top2.is_current_student && <span className="you-label">{t.you}</span>}
                    </div>
                    <div className="podium-score">{top2.average_percentage}%</div>
                    <div className="podium-meta">
                      {top2.attempts_count} tests • {top2.best_cefr_level || "-"}
                    </div>
                  </div>
                  <div className="podium-avatar silver">
                    <span className="podium-rank">2</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="podium-info placeholder">
                    <div className="podium-name">—</div>
                    <div className="podium-score">—</div>
                    <div className="podium-meta">No student</div>
                  </div>
                  <div className="podium-avatar silver empty">
                    <span className="podium-rank">2</span>
                  </div>
                </>
              )}
              <div className="podium-pedestal" />
            </div>

            {/* Rank 1 (Gold) */}
            <div className={`podium-col first ${!top1 ? "empty-pedestal" : ""}`}>
              {top1 ? (
                <>
                  <div className="podium-info">
                    <div className="podium-name">
                      {top1.display_name}
                      {top1.is_current_student && <span className="you-label">{t.you}</span>}
                    </div>
                    <div className="podium-score">{top1.average_percentage}%</div>
                    <div className="podium-meta">
                      {top1.attempts_count} tests • {top1.best_cefr_level || "-"}
                    </div>
                  </div>
                  <div className="podium-avatar gold">
                    <span className="podium-crown">👑</span>
                    <span className="podium-rank">1</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="podium-info placeholder">
                    <div className="podium-name">—</div>
                    <div className="podium-score">—</div>
                    <div className="podium-meta">No student</div>
                  </div>
                  <div className="podium-avatar gold empty">
                    <span className="podium-rank">1</span>
                  </div>
                </>
              )}
              <div className="podium-pedestal" />
            </div>

            {/* Rank 3 (Bronze) */}
            <div className={`podium-col third ${!top3 ? "empty-pedestal" : ""}`}>
              {top3 ? (
                <>
                  <div className="podium-info">
                    <div className="podium-name">
                      {top3.display_name}
                      {top3.is_current_student && <span className="you-label">{t.you}</span>}
                    </div>
                    <div className="podium-score">{top3.average_percentage}%</div>
                    <div className="podium-meta">
                      {top3.attempts_count} tests • {top3.best_cefr_level || "-"}
                    </div>
                  </div>
                  <div className="podium-avatar bronze">
                    <span className="podium-rank">3</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="podium-info placeholder">
                    <div className="podium-name">—</div>
                    <div className="podium-score">—</div>
                    <div className="podium-meta">No student</div>
                  </div>
                  <div className="podium-avatar bronze empty">
                    <span className="podium-rank">3</span>
                  </div>
                </>
              )}
              <div className="podium-pedestal" />
            </div>
          </div>

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
                  <tr
                    key={entry.user_id}
                    className={entry.is_current_student ? "is-current-student" : ""}
                  >
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

          {/* Current User Standings Line */}
          {leaderboard.current_student && (
            <div className="current-user-rank-line">
              <div className="user-rank-title">Your Current Standing</div>
              <div className="user-rank-row">
                <div className="user-rank-cell rank">
                  <span>Rank</span>
                  <strong>#{leaderboard.current_student.rank}</strong>
                </div>
                <div className="user-rank-cell student">
                  <span>Student</span>
                  <strong>
                    {leaderboard.current_student.display_name}{" "}
                    <span className="you-label">{t.you}</span>
                  </strong>
                </div>
                <div className="user-rank-cell tests">
                  <span>Tests</span>
                  <strong>{leaderboard.current_student.attempts_count}</strong>
                </div>
                <div className="user-rank-cell average">
                  <span>Average</span>
                  <strong>{leaderboard.current_student.average_percentage}%</strong>
                </div>
                <div className="user-rank-cell cefr">
                  <span>Best CEFR</span>
                  <span className="badge badge-gray">
                    {leaderboard.current_student.best_cefr_level ?? "-"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="empty-message">{t.empty}</p>
      )}
    </CollapsiblePanel>
  );
}
