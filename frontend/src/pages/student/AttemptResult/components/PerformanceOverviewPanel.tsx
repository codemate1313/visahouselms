import { useState } from "react";
import type { Attempt } from "@/api/types";
import type { AttemptMetrics } from "@/pages/student/attemptMetrics";
import { attemptResultStrings as strings } from "../AttemptResult.strings";
import { ResultRadial } from "./ResultRadial";
import { RADIAL_COLORS } from "./resultRadialColors";
import { LinkButton } from "@/components/ui";
import { formatDate } from "@/utils/date";

interface PerformanceOverviewPanelProps {
  attempt: Attempt;
  metrics: AttemptMetrics;
  awaitingAiGrading?: boolean;
}

/**
 * The headline score, rescaled to a common /100 so every module reads the same
 * way - a Reading paper authored out of 40 and a Writing one out of 25 are
 * otherwise two numbers a candidate cannot compare at a glance.
 *
 * Presentation only. The marks the server stores, grades against and reports
 * are untouched; this just divides them out for the one figure on this card.
 * Returns null when there is nothing sensible to scale (no marks yet, or a
 * module authored with no marks available at all), and the caller then shows
 * the same "pending" text it always did.
 */
function scoreOutOfHundred(attempt: Attempt): string | null {
  if (attempt.raw_score == null || attempt.max_score == null) return null;
  const earned = Number(attempt.raw_score);
  const total = Number(attempt.max_score);
  if (!Number.isFinite(earned) || !Number.isFinite(total) || total <= 0) return null;
  return `${((earned / total) * 100).toFixed(2)} / 100`;
}

export function PerformanceOverviewPanel({ attempt, metrics, awaitingAiGrading }: PerformanceOverviewPanelProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const t = strings.overview;
  const m = strings.metrics;

  const metricRows = [
    { key: "total", label: m.totalQuestions, value: metrics.total, color: "var(--text-muted, #71717a)" },
    { key: "attempted", label: m.attempted, value: metrics.attempted, color: "var(--text, #18181b)" },
    { key: "correct", label: m.correct, value: metrics.correct, color: RADIAL_COLORS.correct },
    { key: "incorrect", label: m.incorrect, value: metrics.incorrect, color: RADIAL_COLORS.incorrect },
    ...(metrics.pending ? [{ key: "pending", label: m.awaitingReview, value: metrics.pending, color: RADIAL_COLORS.pending }] : []),
    { key: "unanswered", label: m.unanswered, value: metrics.unanswered, color: RADIAL_COLORS.unanswered },
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
            <div style={{ display: "flex", alignItems: "center", gap: "4px", height: "30px" }}>
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
        <div className="result-radial-container">
          <ResultRadial metrics={metrics} activeSegment={hoveredKey} onHoverSegment={setHoveredKey} />
        </div>

        <div className="result-metric-list">
          {metricRows.map((metric) => {
            const isInteractive = ["correct", "incorrect", "pending", "unanswered"].includes(metric.key);
            const isHovered = hoveredKey === metric.key;
            return (
              <div
                key={metric.key}
                className={`result-metric-row ${isInteractive ? "is-interactive" : ""} ${isHovered ? "is-active" : ""}`}
                onMouseEnter={() => isInteractive && setHoveredKey(metric.key)}
                onMouseLeave={() => isInteractive && setHoveredKey(null)}
              >
                <span className="result-metric-dot" style={{ backgroundColor: metric.color }} />
                <span className="result-metric-label">{metric.label}</span>
                <strong className="result-metric-value">{metric.value}</strong>
              </div>
            );
          })}
        </div>

        <div className="result-overview-meta">
          <div className="result-meta-item">
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
              <strong>{scoreOutOfHundred(attempt) ?? t.pending}</strong>
            )}
          </div>
          <div className="result-meta-item">
            <span>{t.submitted}</span>
            <strong>{attempt.submitted_at ? formatDate(attempt.submitted_at) : "-"}</strong>
          </div>
          <LinkButton to={`/student/attempts/${attempt.id}/result/details`} className="result-detail-review-btn">
            {t.viewDetailedReview}
          </LinkButton>
        </div>
      </div>
    </section>
  );
}

