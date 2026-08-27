import { useState } from "react";
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

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    strengths: true,
    improvements: false,
    next_steps: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <section className="student-analysis-panel" aria-labelledby="student-analysis-title">
      <div className="student-analysis-heading">
        <div>
          <span className="page-eyebrow">{t.eyebrow}</span>
          <h2 id="student-analysis-title">{t.heading}</h2>
        </div>
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
          {/* Executive Performance Summary Card */}
          <div className="analysis-summary-card">
            <div className="analysis-summary-header">
              <div className="analysis-summary-title-wrap">
                <div className="analysis-summary-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </div>
                <strong className="analysis-summary-title">Performance Summary</strong>
              </div>
              <span
                className={`analysis-engine-pill ${analysis.generated_by === "configured_ai" ? "is-ai" : ""}`}
                title={analysisSourceText}
              >
                {analysisSourceLabel}
              </span>
            </div>
            <p className="analysis-summary-text">{analysis.summary}</p>
          </div>

          <AnalysisBreakdown analysis={analysis} />

          {/* Option 3: Collapsible Insights Accordion */}
          <div className="analysis-accordion-stack">
            {/* Strengths */}
            {analysis.strengths.length > 0 && (
              <div className={`analysis-accordion-card is-strengths ${openSections.strengths ? "is-open" : ""}`}>
                <button
                  type="button"
                  className="analysis-accordion-header"
                  onClick={() => toggleSection("strengths")}
                  aria-expanded={openSections.strengths}
                >
                  <div className="analysis-accordion-title-wrap">
                    <div className="analysis-accordion-icon is-green">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <span className="analysis-accordion-title">{t.whatWentWell}</span>
                    <span className="analysis-accordion-badge is-green">({analysis.strengths.length})</span>
                  </div>
                  <div className="analysis-accordion-chevron">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </button>
                {openSections.strengths && (
                  <div className="analysis-accordion-body">
                    <ul className="analysis-insights-list is-strengths">
                      {analysis.strengths.map((item) => (
                        <li key={item}>
                          <span className="insight-bullet-icon is-green">✓</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Improvements */}
            {analysis.improvements.length > 0 && (
              <div className={`analysis-accordion-card is-improvements ${openSections.improvements ? "is-open" : ""}`}>
                <button
                  type="button"
                  className="analysis-accordion-header"
                  onClick={() => toggleSection("improvements")}
                  aria-expanded={openSections.improvements}
                >
                  <div className="analysis-accordion-title-wrap">
                    <div className="analysis-accordion-icon is-amber">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    </div>
                    <span className="analysis-accordion-title">{t.whatToImprove}</span>
                    <span className="analysis-accordion-badge is-amber">({analysis.improvements.length})</span>
                  </div>
                  <div className="analysis-accordion-chevron">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </button>
                {openSections.improvements && (
                  <div className="analysis-accordion-body">
                    <ul className="analysis-insights-list is-improvements">
                      {analysis.improvements.map((item) => (
                        <li key={item}>
                          <span className="insight-bullet-icon is-amber">!</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Next Practice Steps */}
            {analysis.next_steps.length > 0 && (
              <div className={`analysis-accordion-card is-steps ${openSections.next_steps ? "is-open" : ""}`}>
                <button
                  type="button"
                  className="analysis-accordion-header"
                  onClick={() => toggleSection("next_steps")}
                  aria-expanded={openSections.next_steps}
                >
                  <div className="analysis-accordion-title-wrap">
                    <div className="analysis-accordion-icon is-primary">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                    </div>
                    <span className="analysis-accordion-title">{t.nextPracticeSteps}</span>
                    <span className="analysis-accordion-badge is-primary">({analysis.next_steps.length})</span>
                  </div>
                  <div className="analysis-accordion-chevron">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </button>
                {openSections.next_steps && (
                  <div className="analysis-accordion-body">
                    <ol className="analysis-steps-list">
                      {analysis.next_steps.map((item, index) => (
                        <li key={item}>
                          <span className="step-number-badge">{index + 1}.</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

