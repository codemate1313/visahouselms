import type { StudentBadge, StudentLeaderboard } from "@/api/types";
import { studentProgressStrings as strings } from "../StudentProgress.strings";

interface ProgressStatTilesProps {
  badges: StudentBadge[];
  earnedCount: number;
  leaderboard: StudentLeaderboard;
}

export function ProgressStatTiles({ badges, earnedCount, leaderboard }: ProgressStatTilesProps) {
  const t = strings.stats;
  return (
    <div className="stat-tile-row">
      <div className="stat-tile">
        <p className="stat-label">{t.badgesEarned}</p>
        <p className="stat-value">
          {earnedCount} / {badges.length}
        </p>
      </div>
      <div className="stat-tile">
        <p className="stat-label">{t.instituteRank}</p>
        <p className="stat-value">{leaderboard.current_student ? `#${leaderboard.current_student.rank}` : "-"}</p>
      </div>
      <div className="stat-tile">
        <p className="stat-label">{t.averageScore}</p>
        <p className="stat-value">{leaderboard.current_student ? `${leaderboard.current_student.average_percentage}%` : "-"}</p>
      </div>
      <div className="stat-tile">
        <p className="stat-label">{t.bestCefr}</p>
        <p className="stat-value">{leaderboard.current_student?.best_cefr_level ?? "-"}</p>
      </div>
    </div>
  );
}
