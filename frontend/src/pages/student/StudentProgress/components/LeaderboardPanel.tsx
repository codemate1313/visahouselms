import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import type { StudentLeaderboard } from "@/api/types";
import { Badge, SegmentedControl } from "@/components/ui";
import { studentProgressStrings as strings } from "../StudentProgress.strings";
import { PodiumCrest3D } from "./PodiumCrest3D";

interface LeaderboardPanelProps {
  leaderboard: StudentLeaderboard;
  scope: "institute" | "global";
  onScopeChange: (scope: "institute" | "global") => void;
  isInstituteStudent?: boolean;
}

export function LeaderboardPanel({
  leaderboard,
  scope,
  onScopeChange,
  isInstituteStudent = true,
}: LeaderboardPanelProps) {
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
      {isInstituteStudent && (
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
      )}

      {leaderboard.message ? (
        <p className="empty-message">{leaderboard.message}</p>
      ) : leaderboard.entries.length ? (
        <>
          {/* 3D Visual Score Podium */}
          <div className="leaderboard-podium-container">
            <div className="leaderboard-podium">
              {/* Rank 2 (Silver) */}
              <div className={`podium-col second ${!top2 ? "empty-pedestal" : ""}`}>
                {top2 ? (
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
                ) : (
                  <div className="podium-info placeholder">
                    <div className="podium-name">—</div>
                    <div className="podium-score">—</div>
                    <div className="podium-meta">No student</div>
                  </div>
                )}
                
                <PodiumCrest3D rank={2} isEmpty={!top2} />

                <div className="podium-pedestal-3d">
                  <div className="pedestal-top-cap" />
                  <div className="pedestal-front-face">
                    <span className="pedestal-numeral">2</span>
                  </div>
                  <div className="pedestal-side-face" />
                  <div className="pedestal-base-glow" />
                </div>
              </div>

              {/* Rank 1 (Gold) */}
              <div className={`podium-col first ${!top1 ? "empty-pedestal" : ""}`}>
                {top1 ? (
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
                ) : (
                  <div className="podium-info placeholder">
                    <div className="podium-name">—</div>
                    <div className="podium-score">—</div>
                    <div className="podium-meta">No student</div>
                  </div>
                )}

                <PodiumCrest3D rank={1} isEmpty={!top1} />

                <div className="podium-pedestal-3d">
                  <div className="pedestal-top-cap" />
                  <div className="pedestal-front-face">
                    <span className="pedestal-numeral">1</span>
                  </div>
                  <div className="pedestal-side-face" />
                  <div className="pedestal-base-glow" />
                </div>
              </div>

              {/* Rank 3 (Bronze) */}
              <div className={`podium-col third ${!top3 ? "empty-pedestal" : ""}`}>
                {top3 ? (
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
                ) : (
                  <div className="podium-info placeholder">
                    <div className="podium-name">—</div>
                    <div className="podium-score">—</div>
                    <div className="podium-meta">No student</div>
                  </div>
                )}

                <PodiumCrest3D rank={3} isEmpty={!top3} />

                <div className="podium-pedestal-3d">
                  <div className="pedestal-top-cap" />
                  <div className="pedestal-front-face">
                    <span className="pedestal-numeral">3</span>
                  </div>
                  <div className="pedestal-side-face" />
                  <div className="pedestal-base-glow" />
                </div>
              </div>
            </div>
          </div>

          {/* Current User Standings Card (Positioned Above Table) */}
          {leaderboard.current_student && (
            <div className="current-user-standing-card">
              <div className="user-standing-card-header">
                <div className="user-standing-eyebrow">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  <span>Your Current Standing</span>
                </div>
                <span className="user-standing-cohort-badge">
                  {scope === "global" ? "Global Cohort" : "Institute Cohort"}
                </span>
              </div>
              <div className="user-standing-card-body">
                <div className="user-standing-rank-badge">
                  <small>Rank</small>
                  <strong>#{leaderboard.current_student.rank}</strong>
                </div>

                <div className="user-standing-profile">
                  <div className="user-standing-avatar">
                    {(leaderboard.current_student.display_name || "Y").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="user-standing-name-wrap">
                    <strong className="user-standing-name">{leaderboard.current_student.display_name}</strong>
                    <span className="you-label">{t.you}</span>
                  </div>
                </div>

                <div className="user-standing-stats-grid">
                  <div className="user-standing-stat">
                    <span>{t.tests}</span>
                    <strong>{leaderboard.current_student.attempts_count}</strong>
                  </div>
                  <div className="user-standing-stat">
                    <span>{t.average}</span>
                    <strong>{leaderboard.current_student.average_percentage}%</strong>
                  </div>
                  <div className="user-standing-stat">
                    <span>{t.bestCefr}</span>
                    <Badge tone="gray">
                      {leaderboard.current_student.best_cefr_level ?? "-"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          )}

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
                      <Badge tone="gray">{entry.best_cefr_level ?? "-"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="empty-message">{t.empty}</p>
      )}
    </CollapsiblePanel>
  );
}
