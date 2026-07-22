import { useEffect, useState } from "react";
import { apiClient } from "../../api/client";
import type { StudentBadge, StudentLeaderboard } from "../../api/types";
import { CollapsiblePanel } from "../../components/CollapsiblePanel";
import { Icon, type IconName } from "../../components/icons";

const BADGE_ICONS: Record<string, IconName> = {
  flag: "grading",
  compass: "analytics",
  spark: "overview",
  crown: "products",
  grid: "overview",
  target: "due",
  streak: "analytics",
};

export function StudentProgress() {
  const [badges, setBadges] = useState<StudentBadge[] | null>(null);
  const [leaderboard, setLeaderboard] = useState<StudentLeaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // Achievement refresh also updates the persisted institute standings,
        // so load it before reading the leaderboard snapshot.
        const badgeResponse = await apiClient.get<StudentBadge[]>("/student/achievements");
        const leaderboardResponse = await apiClient.get<StudentLeaderboard>("/student/leaderboard");
        setBadges(badgeResponse.data);
        setLeaderboard(leaderboardResponse.data);
      } catch {
        setError("Failed to load your progress.");
      }
    }
    load();
  }, []);

  if (error) return <p className="error-text">{error}</p>;
  if (!badges || !leaderboard) return <p>Loading...</p>;

  const earned = badges.filter((badge) => badge.earned);

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="page-eyebrow">Student progress</span>
          <h1>Achievements & ranking</h1>
          <p className="page-subtitle">Your CEFR milestones and standing inside your institute cohort.</p>
        </div>
      </div>

      <div className="stat-tile-row">
        <div className="stat-tile"><p className="stat-label">Badges earned</p><p className="stat-value">{earned.length} / {badges.length}</p></div>
        <div className="stat-tile"><p className="stat-label">Institute rank</p><p className="stat-value">{leaderboard.current_student ? `#${leaderboard.current_student.rank}` : "-"}</p></div>
        <div className="stat-tile"><p className="stat-label">Average score</p><p className="stat-value">{leaderboard.current_student ? `${leaderboard.current_student.average_percentage}%` : "-"}</p></div>
        <div className="stat-tile"><p className="stat-label">Best CEFR</p><p className="stat-value">{leaderboard.current_student?.best_cefr_level ?? "-"}</p></div>
      </div>

      <CollapsiblePanel
        className="progress-section"
        title="Badges"
        description="Badges unlock automatically when a graded result meets the stated requirement."
        badge={<span className="count-chip">{earned.length} / {badges.length}</span>}
      >
        <div className="achievement-grid">
          {badges.map((badge) => (
            <article key={badge.code} className={badge.earned ? "is-earned" : "is-locked"}>
              <div className="achievement-icon"><Icon name={BADGE_ICONS[badge.icon] ?? "grading"} /></div>
              <div>
                <span>{badge.earned ? "Earned" : "Locked"}</span>
                <h3>{badge.name}</h3>
                <p>{badge.description}</p>
                {badge.awarded_at && <time>{new Date(badge.awarded_at).toLocaleDateString()}</time>}
              </div>
            </article>
          ))}
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel
        className="progress-section"
        title="Institute leaderboard"
        description="Ranked by average percentage across graded tests. Equal averages share a rank."
        badge={<span className="count-chip">{leaderboard.entries.length}</span>}
      >
        {leaderboard.message ? (
          <p className="empty-message">{leaderboard.message}</p>
        ) : leaderboard.entries.length ? (
          <div className="table-wrap">
            <table className="data-table leaderboard-table">
              <thead><tr><th>Rank</th><th>Student</th><th>Tests</th><th>Average</th><th>Best CEFR</th></tr></thead>
              <tbody>
                {leaderboard.entries.map((entry) => (
                  <tr key={entry.user_id} className={entry.is_current_student ? "is-current-student" : ""}>
                    <td><strong>#{entry.rank}</strong></td>
                    <td>{entry.display_name}{entry.is_current_student && <span className="you-label">You</span>}</td>
                    <td>{entry.attempts_count}</td>
                    <td>{entry.average_percentage}%</td>
                    <td><span className="badge badge-gray">{entry.best_cefr_level ?? "-"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-message">Complete a graded test to join your institute leaderboard.</p>
        )}
      </CollapsiblePanel>
    </div>
  );
}
