import type { StudentResultAnalysis } from "@/api/types";
import { attemptResultStrings as strings } from "../AttemptResult.strings";
import { AnalysisBreakdown } from "./AnalysisBreakdown";

interface AnalysisPanelProps {
  analysis: StudentResultAnalysis | null;
  analysisError: boolean;
  awaitingAiGrading?: boolean;
  manualReviewRequired?: boolean;
  /** Ask the AI to mark the unmarked parts again. Absent when there is nothing to retry. */
  onRetryAi?: () => void;
  retryingAi?: boolean;
  retryMessage?: string | null;
}

export function AnalysisPanel({
  analysis,
  analysisError,
  awaitingAiGrading,
  manualReviewRequired,
  onRetryAi,
  retryingAi,
  retryMessage,
}: AnalysisPanelProps) {
  const t = strings.analysis;
  const analysisSourceLabel = analysis?.generated_by === "configured_ai" ? t.aiEvaluated : t.cefrAnalysis;
  const analysisSourceText = analysis?.generated_by === "configured_ai" ? t.aiSourceText : t.cefrSourceText;

  return (
    <section className="student-analysis-panel" aria-labelledby="student-analysis-title">
      <div className="student-analysis-heading">
        <div>
          <span className="page-eyebrow">{t.eyebrow}</span>
          <h2 id="student-analysis-title">{t.heading}</h2>
        </div>
        {analysis && <span className={`analysis-source ${analysis.generated_by === "configured_ai" ? "is-ai" : ""}`}>{analysisSourceLabel}</span>}
      </div>

      {awaitingAiGrading && (
        <div className="banner warning" style={{ display: "flex", alignItems: "center", gap: "12px", maxWidth: "none" }}>
          <span className="color-dots-loader" style={{ width: "auto", height: "auto", gap: "4px" }}>
            <span style={{ width: "8px", height: "8px", flex: "0 0 8px" }} />
            <span style={{ width: "8px", height: "8px", flex: "0 0 8px" }} />
            <span style={{ width: "8px", height: "8px", flex: "0 0 8px" }} />
          </span>
          <span>{t.aiPending}</span>
        </div>
      )}

      {manualReviewRequired && (
        <div className="banner warning" style={{ display: "flex", alignItems: "center", gap: "12px", maxWidth: "none", flexWrap: "wrap" }}>
          <span>{t.manualReview}</span>
          {onRetryAi && (
            <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" onClick={onRetryAi} disabled={retryingAi}>
              {retryingAi ? strings.aiEvaluation.retrying : strings.aiEvaluation.retryAi}
            </button>
          )}
        </div>
      )}

      {retryMessage && <p className="hint" style={{ marginTop: -4 }}>{retryMessage}</p>}

      {!analysis && !analysisError && <div className="analysis-loading">{t.analysing}</div>}
      {analysisError && <p className="error-text">{t.unavailable}</p>}
      {analysis && (
        <>
          <div className={`banner ${analysis.generated_by === "configured_ai" ? "ai-review-banner" : ""}`}>
            <strong>{analysisSourceLabel}</strong> {analysisSourceText}
          </div>
          <p className="student-analysis-summary">{analysis.summary}</p>
          {analysis.section_metrics.length > 0 && (
            <div className="analysis-skill-list" aria-label="Skill performance">
              {analysis.section_metrics.map((skill) => (
                <div key={skill.skill}>
                  <div>
                    <strong>{skill.label}</strong>
                    <span>{skill.cefr_level ?? `${skill.percentage}%`}</span>
                  </div>
                  <div className="analysis-skill-track">
                    <span style={{ width: `${Math.min(100, Number(skill.percentage))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <AnalysisBreakdown analysis={analysis} />
          <div className="student-analysis-columns">
            <div>
              <h3>{t.whatWentWell}</h3>
              <ul>
                {analysis.strengths.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>{t.whatToImprove}</h3>
              <ul>
                {analysis.improvements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>{t.nextPracticeSteps}</h3>
              <ol>
                {analysis.next_steps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </div>
          </div>
          <p className="analysis-disclaimer">{t.disclaimer(analysis.framework_version)}</p>
        </>
      )}
    </section>
  );
}
