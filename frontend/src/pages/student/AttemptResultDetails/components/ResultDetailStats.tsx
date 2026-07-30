import type { AttemptMetrics } from "@/pages/student/attemptMetrics";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { attemptResultDetailsStrings as strings } from "../AttemptResultDetails.strings";

interface ResultDetailStatsProps {
  metrics: AttemptMetrics;
}

export function ResultDetailStats({ metrics }: ResultDetailStatsProps) {
  const t = strings.stats;
  return (
    <div className="metric-grid result-detail-stats">
      <MetricCard label={t.attempted} value={`${metrics.attempted} / ${metrics.total}`} tone="blue" icon="grading" />
      <MetricCard label={t.correct} value={metrics.correct} valueClassName="result-correct-text" tone="green" icon="check" />
      <MetricCard label={t.incorrect} value={metrics.incorrect} valueClassName="due-text" tone="amber" icon="cross" />
      <MetricCard label={t.unanswered} value={metrics.unanswered} tone="slate" icon="help" />
    </div>
  );
}
