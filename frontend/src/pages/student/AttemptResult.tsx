import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiClient } from "../../api/client";
import type { Attempt, StudentResultAnalysis } from "../../api/types";
import { getAttemptMetrics } from "./attemptMetrics";

const STATUS_LABEL: Record<string, string> = {
  submitted: "Auto-grading in progress",
  grading: "Awaiting instructor grading",
  graded: "Graded",
  expired: "Expired before submission",
};

const RADIAL_COLORS = {
  correct: "#16865b",
  incorrect: "#e11d2e",
  pending: "#d79018",
  unanswered: "#d7d9df",
};

function ResultRadial({ metrics }: { metrics: ReturnType<typeof getAttemptMetrics> }) {
  const segments = [
    { key: "correct", value: metrics.correct, color: RADIAL_COLORS.correct },
    { key: "incorrect", value: metrics.incorrect, color: RADIAL_COLORS.incorrect },
    { key: "pending", value: metrics.pending, color: RADIAL_COLORS.pending },
    { key: "unanswered", value: metrics.unanswered, color: RADIAL_COLORS.unanswered },
  ];
  let offset = 0;

  return (
    <div className="result-radial" role="img" aria-label={`${metrics.attempted} of ${metrics.total} attempted, ${metrics.correct} correct`}>
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <circle className="result-radial-track" cx="100" cy="100" r="76" pathLength="100" />
        {metrics.total > 0 && segments.map((segment) => {
          const percentage = segment.value * 100 / metrics.total;
          const dashOffset = -offset;
          offset += percentage;
          return (
            <circle
              key={segment.key}
              className="result-radial-segment"
              cx="100"
              cy="100"
              r="76"
              pathLength="100"
              stroke={segment.color}
              strokeDasharray={`${percentage} ${100 - percentage}`}
              strokeDashoffset={dashOffset}
            />
          );
        })}
      </svg>
      <div className="result-radial-center">
        <strong>{metrics.attempted}<span>/{metrics.total}</span></strong>
        <small>attempted</small>
      </div>
    </div>
  );
}

export function AttemptResult() {
  const { id } = useParams();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [analysis, setAnalysis] = useState<StudentResultAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState(false);

  useEffect(() => {
    let active = true;
    apiClient
      .get<Attempt>(`/student/attempts/${id}`)
      .then(({ data }) => { if (active) setAttempt(data); })
      .catch(() => { if (active) setError("Failed to load this result."); });
    apiClient
      .get<StudentResultAnalysis>(`/student/attempts/${id}/analysis`, { headers: { "X-Skip-Loader": "1" } })
      .then(({ data }) => { if (active) setAnalysis(data); })
      .catch(() => { if (active) setAnalysisError(true); });
    return () => { active = false; };
  }, [id]);

  const metrics = useMemo(() => attempt ? getAttemptMetrics(attempt) : null, [attempt]);

  if (error && !attempt) return <p className="error-text">{error}</p>;
  if (!attempt || !metrics) return <p>Loading...</p>;

  const metricRows = [
    { label: "Total questions", value: metrics.total, color: "#72737a" },
    { label: "Attempted", value: metrics.attempted, color: "#303138" },
    { label: "Correct", value: metrics.correct, color: RADIAL_COLORS.correct },
    { label: "Incorrect", value: metrics.incorrect, color: RADIAL_COLORS.incorrect },
    ...(metrics.pending ? [{ label: "Awaiting review", value: metrics.pending, color: RADIAL_COLORS.pending }] : []),
    { label: "Unanswered", value: metrics.unanswered, color: RADIAL_COLORS.unanswered },
  ];

  return (
    <div className="result-overview-page">
      <div className="page-header result-page-header">
        <div>
          <span className="page-eyebrow">Result overview</span>
          <h1>{attempt.module_title}</h1>
          <p className="page-subtitle">{STATUS_LABEL[attempt.status] ?? attempt.status}</p>
        </div>
        <Link className="button-link" to="/student/attempts">All attempts</Link>
      </div>

      <section className="result-overview-panel" aria-labelledby="performance-overview-title">
        <div className="result-overview-heading">
          <div>
            <span className="page-eyebrow">Performance</span>
            <h2 id="performance-overview-title">Question overview</h2>
          </div>
          <div className="result-overview-score">
            <span>CEFR level</span>
            <strong>{attempt.band_label ?? "Pending"}</strong>
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
            <div><span>Score</span><strong>{attempt.raw_score != null && attempt.max_score != null ? `${attempt.raw_score} / ${attempt.max_score}` : "Pending"}</strong></div>
            <div><span>Submitted</span><strong>{attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleDateString() : "-"}</strong></div>
            <Link className="button-link" to={`/student/attempts/${attempt.id}/result/details`}>View detailed review</Link>
          </div>
        </div>
      </section>

      <section className="student-analysis-panel" aria-labelledby="student-analysis-title">
        <div className="student-analysis-heading">
          <div>
            <span className="page-eyebrow">Personalized coaching</span>
            <h2 id="student-analysis-title">Performance analysis</h2>
          </div>
          {analysis && <span className={`analysis-source ${analysis.ai_enabled ? "is-ai" : ""}`}>{analysis.ai_enabled ? "AI generated" : "CEFR analysis"}</span>}
        </div>

        {!analysis && !analysisError && <div className="analysis-loading">Analysing your result...</div>}
        {analysisError && <p className="error-text">The analysis is temporarily unavailable. Your detailed result is still ready to review.</p>}
        {analysis && (
          <>
            <p className="student-analysis-summary">{analysis.summary}</p>
            {analysis.section_metrics.length > 0 && (
              <div className="analysis-skill-list" aria-label="Skill performance">
                {analysis.section_metrics.map((skill) => (
                  <div key={skill.skill}>
                    <div><strong>{skill.label}</strong><span>{skill.cefr_level ?? `${skill.percentage}%`}</span></div>
                    <div className="analysis-skill-track"><span style={{ width: `${Math.min(100, Number(skill.percentage))}%` }} /></div>
                  </div>
                ))}
              </div>
            )}
            <div className="student-analysis-columns">
              <div>
                <h3>What went well</h3>
                <ul>{analysis.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <div>
                <h3>What to improve</h3>
                <ul>{analysis.improvements.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <div>
                <h3>Next practice steps</h3>
                <ol>{analysis.next_steps.map((item) => <li key={item}>{item}</li>)}</ol>
              </div>
            </div>
            <p className="analysis-disclaimer">Generated from your recorded answers and {analysis.framework_version} profile. Use examiner feedback as the final reference for human-marked responses.</p>
          </>
        )}
      </section>
    </div>
  );
}
