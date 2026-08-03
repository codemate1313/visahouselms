import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import type { Attempt, ReevaluationRequestView, StudentNotification, StudentResultAnalysis } from "@/api/types";
import { getAttemptMetrics } from "@/pages/student/attemptMetrics";
import { attemptResultStrings as strings } from "./AttemptResult.strings";
import { PerformanceOverviewPanel } from "./components/PerformanceOverviewPanel";
import { AnalysisPanel } from "./components/AnalysisPanel";
import { ReevaluationStatus } from "@/components/ReevaluationStatus";
import { ReevaluationRequestForm } from "./components/ReevaluationRequestForm";
import { RetakeRequestStatus } from "./components/RetakeRequestStatus";
import { RetakeRequestForm } from "./components/RetakeRequestForm";
import { Badge, LinkButton } from "@/components/ui";

// AI auto-grading runs as a background job right after submission (a
// provider call can take a while), so a freshly submitted human-graded
// attempt is polled briefly for the result to land.
const AI_GRADING_POLL_INTERVAL_MS = 4000;
const AI_GRADING_POLL_MAX_ATTEMPTS = 15;

export function AttemptResult() {
  const { id } = useParams();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [analysis, setAnalysis] = useState<StudentResultAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState(false);
  const [reviewReason, setReviewReason] = useState("");
  const [requestingReview, setRequestingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [retakeReason, setRetakeReason] = useState("");
  const [requestingRetake, setRequestingRetake] = useState(false);
  const mountedAtRef = useRef(new Date().toISOString());

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
  const aiManualReviewRequired = attempt?.ai_evaluation_status === "manual_required";

  useEffect(() => {
    if (!awaitingAiGrading) return;
    let active = true;
    let attempts = 0;

    const timer = window.setInterval(() => {
      attempts += 1;
      if (attempts > AI_GRADING_POLL_MAX_ATTEMPTS) {
        window.clearInterval(timer);
        return;
      }
      apiClient
        .get<Attempt>(`/student/attempts/${id}`, { headers: { "X-Skip-Loader": "1" } })
        .then(({ data }) => {
          if (!active) return;
          if (data.status !== "grading") {
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
  }, [awaitingAiGrading, id]);

  const metrics = useMemo(() => attempt ? getAttemptMetrics(attempt) : null, [attempt]);

  if (error && !attempt) return <p className="error-text">{error}</p>;
  if (!attempt || !metrics) return <p>{strings.loading}</p>;

  const hasInstructorReviewablePart = attempt.parts.some((part) => !part.auto_marked);
  const hasOpenReevaluation = attempt.reevaluation?.status === "pending" || attempt.reevaluation?.status === "in_review";
  const canRequestReview = ["grading", "graded"].includes(attempt.status) && hasInstructorReviewablePart && !hasOpenReevaluation;
  
  const hasOpenOrApprovedRetake =
    attempt.retake_request?.status === "pending" ||
    (attempt.retake_request?.status === "approved" && !attempt.retake_request.consumed_at);
  const canRequestRetake =
    ["submitted", "grading", "graded", "expired"].includes(attempt.status) && !hasOpenOrApprovedRetake;

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
            {awaitingAiGrading ? (
              <>
                <span>{strings.aiEvaluation.inProgress}</span>
                <span className="color-dots-loader" style={{ width: "auto", height: "auto", gap: "4px" }}>
                  <span style={{ width: "8px", height: "8px", flex: "0 0 8px" }} />
                  <span style={{ width: "8px", height: "8px", flex: "0 0 8px" }} />
                  <span style={{ width: "8px", height: "8px", flex: "0 0 8px" }} />
                </span>
              </>
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
        <LinkButton to="/student/attempts">
          {strings.allAttempts}
        </LinkButton>
      </div>

      <PerformanceOverviewPanel attempt={attempt} metrics={metrics} awaitingAiGrading={awaitingAiGrading} />
      <AnalysisPanel
        analysis={analysis}
        analysisError={analysisError}
        awaitingAiGrading={awaitingAiGrading}
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

      {canRequestReview && (
        <ReevaluationRequestForm
          reviewReason={reviewReason}
          onReviewReasonChange={setReviewReason}
          requesting={requestingReview}
          reviewError={reviewError}
          onSubmit={requestInstructorReview}
        />
      )}

      {attempt.retake_request && <RetakeRequestStatus retakeRequest={attempt.retake_request} />}

      {canRequestRetake && (
        <RetakeRequestForm
          reason={retakeReason}
          onReasonChange={setRetakeReason}
          requesting={requestingRetake}
          onSubmit={requestRetake}
        />
      )}
    </div>
  );
}
