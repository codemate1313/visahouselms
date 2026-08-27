import type { StudentBadge, StudentLeaderboard } from "@/api/types";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { studentProgressStrings as strings } from "../StudentProgress.strings";

interface ProgressStatTilesProps {
  badges: StudentBadge[];
  earnedCount: number;
  leaderboard: StudentLeaderboard;
}

export function ProgressStatTiles({ badges, earnedCount, leaderboard }: ProgressStatTilesProps) {
  const t = strings.stats;
  return (
    <div className="progress-stat-tiles metric-grid">
      <MetricCard label={t.badgesEarned} value={`${earnedCount} / ${badges.length}`} tone="amber" icon="check" />
      <MetricCard label={t.instituteRank} value={leaderboard.current_student ? `#${leaderboard.current_student.rank}` : "-"} tone="blue" icon="analytics" />
      <MetricCard label={t.averageScore} value={leaderboard.current_student ? `${leaderboard.current_student.average_percentage}%` : "-"} tone="green" icon="dashboard" />
      <MetricCard label={t.bestCefr} value={leaderboard.current_student?.best_cefr_level ?? "-"} tone="purple" icon="module" />
    </div>
  );
}
