import type { Attempt } from "@/api/types";
import type { AttemptMetrics } from "@/pages/student/attemptMetrics";
import { attemptResultStrings as strings } from "../AttemptResult.strings";
import { RADIAL_COLORS, ResultRadial } from "./ResultRadial";
import { LinkButton } from "@/components/ui";
import { formatDate } from "@/utils/date";

interface PerformanceOverviewPanelProps {
  attempt: Attempt;
  metrics: AttemptMetrics;
  awaitingAiGrading?: boolean;
}

export function PerformanceOverviewPanel({ attempt, metrics, awaitingAiGrading }: PerformanceOverviewPanelProps) {
  const t = strings.overview;
  const m = strings.metrics;
  const metricRows = [
    { label: m.totalQuestions, value: metrics.total, color: "var(--shade-72737a)" },
    { label: m.attempted, value: metrics.attempted, color: "var(--shade-303138)" },
    { label: m.correct, value: metrics.correct, color: RADIAL_COLORS.correct },
    { label: m.incorrect, value: metrics.incorrect, color: RADIAL_COLORS.incorrect },
    ...(metrics.pending ? [{ label: m.awaitingReview, value: metrics.pending, color: RADIAL_COLORS.pending }] : []),
    { label: m.unanswered, value: metrics.unanswered, color: RADIAL_COLORS.unanswered },
  ];

  return (
    <section className="result-overview-panel" aria-labelledby="performance-overview-title">
      <div className="result-overview-heading">
        <div>
          <span className="page-eyebrow">{t.performanceEyebrow}</span>
          <h2 id="performance-overview-title">{t.heading}</h2>
        </div>
        <div className="result-overview-score">
          <span>{t.cefrLevel}</span>
          {awaitingAiGrading ? (
            <div style={{ display: "flex", alignItems: "center", gap: "4px", height: "34px" }}>
              <span className="color-dots-loader" style={{ width: "auto", height: "auto", gap: "3px" }}>
                <span style={{ width: "6px", height: "6px", flex: "0 0 6px" }} />
                <span style={{ width: "6px", height: "6px", flex: "0 0 6px" }} />
                <span style={{ width: "6px", height: "6px", flex: "0 0 6px" }} />
              </span>
            </div>
          ) : (
            <strong>{attempt.band_label ?? t.pending}</strong>
          )}
        </div>
      </div>

      <div className="result-overview-body">
        <ResultRadial metrics={metrics} />
        <div className="result-metric-list">
          {metricRows.map((metric) => (
            <div key={metric.label}>
              <span className="result-metric-dot" style={{ backgroundColor: metric.color }} />
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>
        <div className="result-overview-meta">
          <div>
            <span>{t.score}</span>
            {awaitingAiGrading ? (
              <div style={{ display: "flex", alignItems: "center", gap: "4px", height: "24px" }}>
                <span className="color-dots-loader" style={{ width: "auto", height: "auto", gap: "3px" }}>
                  <span style={{ width: "6px", height: "6px", flex: "0 0 6px" }} />
                  <span style={{ width: "6px", height: "6px", flex: "0 0 6px" }} />
                  <span style={{ width: "6px", height: "6px", flex: "0 0 6px" }} />
                </span>
              </div>
            ) : (
              <strong>{attempt.raw_score != null && attempt.max_score != null ? `${attempt.raw_score} / ${attempt.max_score}` : t.pending}</strong>
            )}
          </div>
          <div>
            <span>{t.submitted}</span>
            <strong>{attempt.submitted_at ? formatDate(attempt.submitted_at) : "-"}</strong>
          </div>
          <LinkButton to={`/student/attempts/${attempt.id}/result/details`}>
            {t.viewDetailedReview}
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
