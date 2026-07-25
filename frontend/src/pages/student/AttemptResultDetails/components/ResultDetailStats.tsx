import type { AttemptMetrics } from "@/pages/student/attemptMetrics";
import { attemptResultDetailsStrings as strings } from "../AttemptResultDetails.strings";

interface ResultDetailStatsProps {
  metrics: AttemptMetrics;
}

export function ResultDetailStats({ metrics }: ResultDetailStatsProps) {
  const t = strings.stats;
  return (
    <div className="stat-tile-row result-detail-stats">
      <div className="stat-tile">
        <p className="stat-label">{t.attempted}</p>
        <p className="stat-value">
          {metrics.attempted} / {metrics.total}
        </p>
      </div>
      <div className="stat-tile">
        <p className="stat-label">{t.correct}</p>
        <p className="stat-value result-correct-text">{metrics.correct}</p>
      </div>
      <div className="stat-tile">
        <p className="stat-label">{t.incorrect}</p>
        <p className="stat-value due-text">{metrics.incorrect}</p>
      </div>
      <div className="stat-tile">
        <p className="stat-label">{t.unanswered}</p>
        <p className="stat-value">{metrics.unanswered}</p>
      </div>
    </div>
  );
}
