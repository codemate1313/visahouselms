import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import type { Attempt, ReevaluationRequestView, StudentNotification, StudentResultAnalysis } from "@/api/types";
import { getAttemptMetrics } from "@/pages/student/attemptMetrics";
import { attemptResultStrings as strings } from "./AttemptResult.strings";
import { PerformanceOverviewPanel } from "./components/PerformanceOverviewPanel";
import { AnalysisPanel } from "./components/AnalysisPanel";
import { AiEvaluationProgress } from "./components/AiEvaluationProgress";
import { ReevaluationStatus } from "@/components/ReevaluationStatus";
import { ReevaluationRequestModal } from "./components/ReevaluationRequestForm";
import { RetakeRequestStatus } from "./components/RetakeRequestStatus";
import { RetakeRequestModal } from "./components/RetakeRequestForm";
import { Badge } from "@/components/ui";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/Button/Button";

// AI auto-grading runs as a background job right after submission (a
// provider call can take a while), so a freshly submitted human-graded
// attempt is polled briefly for the result to land.
const AI_GRADING_POLL_INTERVAL_MS = 4000;
// The watch has to outlast the countdown the student is looking at, or the
// page gives up at a minute while their timer still reads two.
const AI_GRADING_POLL_MIN_MS = 60_000;
const AI_GRADING_POLL_MAX_MS = 6 * 60_000;

export function AttemptResult() {
  const { id } = useParams();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [analysis, setAnalysis] = useState<StudentResultAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState(false);
  const [reviewReason, setReviewReason] = useState("");
  const [requestingReview, setRequestingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [retakeReason, setRetakeReason] = useState("");
  const [requestingRetake, setRequestingRetake] = useState(false);
  const [showRetakeModal, setShowRetakeModal] = useState(false);
  const mountedAtRef = useRef(new Date().toISOString());
  // How long to keep watching, read inside the interval so a re-estimate does
  // not tear the poll down and start it again.
  const pollWindowRef = useRef(AI_GRADING_POLL_MIN_MS);
  // The poll gives up after a minute. Grading can legitimately still be
  // running at that point, so the page has to say so instead of leaving a
  // spinner that no longer watches anything.
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [retryingAi, setRetryingAi] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiClient
      .get<Attempt>(`/student/attempts/${id}`)
      .then(({ data }) => { if (active) setAttempt(data); })
      .catch(() => { if (active) setError(strings.loadError); });
    apiClient
      .get<StudentResultAnalysis>(`/student/attempts/${id}/analysis`, { headers: { "X-Skip-Loader": "1" } })
      .then(({ data }) => { if (active) setAnalysis(data); })
      .catch(() => { if (active) setAnalysisError(true); });
    return () => { active = false; };
  }, [id]);

  const awaitingAiGrading = attempt?.ai_evaluation_status === "pending";
  const aiProgress = attempt?.ai_evaluation_progress ?? null;
  const aiEstimateSeconds = aiProgress?.estimated_seconds ?? 0;
  const aiManualReviewRequired = attempt?.ai_evaluation_status === "manual_required";

  // Half again the estimate, plus a margin for the queue: long enough that the
  // watch outlives the countdown, capped so a stuck job cannot poll for ever.
  useEffect(() => {
    pollWindowRef.current = Math.min(
      AI_GRADING_POLL_MAX_MS,
      Math.max(AI_GRADING_POLL_MIN_MS, aiEstimateSeconds * 1500 + 30_000),
    );
  }, [aiEstimateSeconds]);

  useEffect(() => {
    // `pollTimedOut` is a dependency, not just state: clearing it from the
    // "Check now" button is what arms a fresh watch.
    if (!awaitingAiGrading || pollTimedOut) return;
    let active = true;
    let attempts = 0;

    const timer = window.setInterval(() => {
      attempts += 1;
      if (attempts * AI_GRADING_POLL_INTERVAL_MS > pollWindowRef.current) {
        window.clearInterval(timer);
        if (active) setPollTimedOut(true);
        return;
      }
      apiClient
        .get<Attempt>(`/student/attempts/${id}`, { headers: { "X-Skip-Loader": "1" } })
        .then(({ data }) => {
          if (!active) return;
          if (data.ai_evaluation_status !== "pending") {
            window.clearInterval(timer);
            apiClient
              .get<StudentResultAnalysis>(`/student/attempts/${id}/analysis`, { headers: { "X-Skip-Loader": "1" } })
              .then(({ data: analysisData }) => {
                if (active) {
                  setAttempt(data);
                  setAnalysis(analysisData);
                  setAnalysisError(false);
                }
              })
              .catch(() => {
                if (active) {
                  setAttempt(data);
                  setAnalysisError(true);
                }
              });
          } else {
            setAttempt(data);
          }
        })
        .catch(() => {});
      apiClient
        .get<StudentNotification[]>("/notifications", { headers: { "X-Skip-Loader": "1" } })
        .then(({ data }) => {
          if (!active) return;
          const aiStopped = data.some(
            (item) => item.kind === "ai_evaluation_failed" && item.created_at >= mountedAtRef.current,
          );
          if (aiStopped) {
            window.clearInterval(timer);
            Promise.all([
              apiClient.get<Attempt>(`/student/attempts/${id}`, { headers: { "X-Skip-Loader": "1" } }),
              apiClient.get<StudentResultAnalysis>(`/student/attempts/${id}/analysis`, { headers: { "X-Skip-Loader": "1" } })
            ]).then(([{ data: attemptData }, { data: analysisData }]) => {
              if (active) {
                setAttempt(attemptData);
                setAnalysis(analysisData);
                setAnalysisError(false);
              }
            }).catch(() => {
              apiClient.get<Attempt>(`/student/attempts/${id}`, { headers: { "X-Skip-Loader": "1" } })
                .then(({ data: attemptData }) => {
                  if (active) setAttempt(attemptData);
                })
                .catch(() => {});
            });
          }
        })
        .catch(() => {});
    }, AI_GRADING_POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [awaitingAiGrading, id, pollTimedOut]);

  // A different attempt starts its own watch.
  useEffect(() => setPollTimedOut(false), [id]);

  async function retryAiEvaluation() {
    setRetryingAi(true);
    setRetryMessage(null);
    try {
      const { data } = await apiClient.post<{ message: string }>(`/student/attempts/${id}/ai-retry`);
      setRetryMessage(data.message);
      // Queued work lands in the background: put the page back on watch so the
      // result appears without a manual reload.
      setPollTimedOut(false);
      await recheckGrading();
    } catch (err: unknown) {
      setRetryMessage(extractErrorMessage(err, strings.aiEvaluation.retryFailed));
    } finally {
      setRetryingAi(false);
    }
  }

  async function recheckGrading() {
    setRechecking(true);
    try {
      const { data } = await apiClient.get<Attempt>(`/student/attempts/${id}`, {
        headers: { "X-Skip-Loader": "1" },
      });
      setAttempt(data);
      const { data: analysisData } = await apiClient.get<StudentResultAnalysis>(
        `/student/attempts/${id}/analysis`,
        { headers: { "X-Skip-Loader": "1" } },
      );
      setAnalysis(analysisData);
      setAnalysisError(false);
      // Still grading: hand the watch back to the poll for another minute.
      if (data.ai_evaluation_status === "pending") setPollTimedOut(false);
    } catch {
      setAnalysisError(true);
    } finally {
      setRechecking(false);
    }
  }

  const metrics = useMemo(() => attempt ? getAttemptMetrics(attempt) : null, [attempt]);

  if (error && !attempt) return <p className="error-text">{error}</p>;
  if (!attempt || !metrics) return <p>{strings.loading}</p>;

  const hasInstructorReviewablePart = attempt.parts.some((part) => !part.auto_marked);
  const hasOpenReevaluation = attempt.reevaluation?.status === "pending" || attempt.reevaluation?.status === "in_review";
  const canRequestReview = ["grading", "graded"].includes(attempt.status) && hasInstructorReviewablePart && !hasOpenReevaluation;
  
  const canRequestRetake =
    !attempt.is_final &&
    attempt.module_type !== "final_test" &&
    ["submitted", "grading", "graded", "expired"].includes(attempt.status) &&
    !attempt.retake_request;

  const isAiGraded = attempt.parts.some((part) => part.grade?.status === "ai_graded");
  const statusLabels = strings.statusLabels;

  async function requestInstructorReview(event: FormEvent) {
    event.preventDefault();
    if (!attempt) return;
    setRequestingReview(true);
    setReviewError(null);
    try {
      const { data } = await apiClient.post<ReevaluationRequestView>(
        `/student/attempts/${attempt.id}/reevaluation`,
        { reason: reviewReason }
      );
      setAttempt((current) => current ? { ...current, reevaluation: data } : current);
      setReviewReason("");
      setShowReviewModal(false);
    } catch (err: unknown) {
      setReviewError(extractErrorMessage(err, strings.reevaluationForm.errors.submit));
    } finally {
      setRequestingReview(false);
    }
  }

  async function requestRetake(event: FormEvent) {
    event.preventDefault();
    if (!attempt) return;
    setRequestingRetake(true);
    setReviewError(null);
    try {
      const { data } = await apiClient.post(`/student/attempts/${attempt.id}/retake-request`, { reason: retakeReason });
      setAttempt((current) => current ? { ...current, retake_request: data } : current);
      setRetakeReason("");
      setShowRetakeModal(false);
    } catch (err: unknown) {
      setReviewError(extractErrorMessage(err, strings.retake.errors.submit));
    } finally {
      setRequestingRetake(false);
    }
  }

  return (
    <div className="result-overview-page">
      <div className="page-header result-page-header">
        <div>
          <span className="page-eyebrow">{strings.eyebrow}</span>
          <h1>{attempt.module_title}</h1>
          <p className="page-subtitle" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {awaitingAiGrading && pollTimedOut ? (
              <>
                <span>{strings.aiEvaluation.stillRunning}</span>
                <Button type="button" variant="secondary" size="sm" onClick={() => void recheckGrading()} disabled={rechecking}>
                  {rechecking ? strings.aiEvaluation.checking : strings.aiEvaluation.checkAgain}
                </Button>
              </>
            ) : awaitingAiGrading ? (
              aiProgress ? (
                <AiEvaluationProgress progress={aiProgress} variant="inline" />
              ) : (
                <>
                  <span>{strings.aiEvaluation.inProgress}</span>
                  <span className="color-dots-loader" style={{ width: "auto", height: "auto", gap: "4px" }}>
                    <span style={{ width: "8px", height: "8px", flex: "0 0 8px" }} />
                    <span style={{ width: "8px", height: "8px", flex: "0 0 8px" }} />
                    <span style={{ width: "8px", height: "8px", flex: "0 0 8px" }} />
                  </span>
                </>
              )
            ) : aiManualReviewRequired && attempt.status === "grading" ? (
              strings.aiEvaluation.manualReview
            ) : (
              statusLabels[attempt.status as keyof typeof statusLabels] ?? attempt.status
            )}
            {isAiGraded && (
              <Badge tone="info" className="result-ai-graded-badge">
                {strings.overview.aiGradedBadge}
              </Badge>
            )}
          </p>
        </div>
      </div>

      <PerformanceOverviewPanel attempt={attempt} metrics={metrics} awaitingAiGrading={awaitingAiGrading} />
      <AnalysisPanel
        analysis={analysis}
        analysisError={analysisError}
        awaitingAiGrading={awaitingAiGrading}
        aiProgress={aiProgress}
        onRetryAi={aiManualReviewRequired && attempt.status === "grading" ? () => void retryAiEvaluation() : undefined}
        retryingAi={retryingAi}
        retryMessage={retryMessage}
        manualReviewRequired={aiManualReviewRequired && attempt.status === "grading"}
      />

      {attempt.reevaluation && (
        <ReevaluationStatus
          reevaluation={attempt.reevaluation}
          strings={{
            eyebrow: strings.reevaluation.eyebrow,
            heading: strings.reevaluation.requestSentHeading,
            reviewerPrefix: strings.reevaluation.reviewerPrefix,
            resolutionHeading: strings.reevaluation.resolutionHeading,
          }}
        />
      )}

      {attempt.retake_request && <RetakeRequestStatus retakeRequest={attempt.retake_request} />}

      {/* Option 2: Sleek Single-Line Support Action Strip */}
      {(canRequestReview || canRequestRetake) && (
        <div className="result-support-strip">
          <div className="result-support-strip-left">
            <div className="result-support-strip-icon-wrap">
              <Icon name="help" className="result-support-strip-icon" />
            </div>
            <div className="result-support-strip-text">
              <h4>{strings.supportStrip.title}</h4>
              <p>{strings.supportStrip.subtitle}</p>
            </div>
          </div>
          <div className="result-support-strip-actions">
            {canRequestReview && (
              <Button
                type="button"
                variant="secondary"
                className="result-support-btn"
                onClick={() => {
                  setReviewError(null);
                  setShowReviewModal(true);
                }}
              >
                <Icon name="instructors" />
                <span>{strings.supportStrip.reviewBtn}</span>
              </Button>
            )}
            {canRequestRetake && (
              <Button
                type="button"
                variant="secondary"
                className="result-support-btn"
                onClick={() => {
                  setReviewError(null);
                  setShowRetakeModal(true);
                }}
              >
                <Icon name="due" />
                <span>{strings.supportStrip.retakeBtn}</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Review Request Modal */}
      {canRequestReview && (
        <ReevaluationRequestModal
          open={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          reviewReason={reviewReason}
          onReviewReasonChange={setReviewReason}
          requesting={requestingReview}
          reviewError={reviewError}
          onSubmit={requestInstructorReview}
        />
      )}

      {/* Retake Request Modal */}
      {canRequestRetake && (
        <RetakeRequestModal
          open={showRetakeModal}
          onClose={() => setShowRetakeModal(false)}
          reason={retakeReason}
          onReasonChange={setRetakeReason}
          requesting={requestingRetake}
          error={reviewError}
          onSubmit={requestRetake}
        />
      )}
    </div>
  );
}
