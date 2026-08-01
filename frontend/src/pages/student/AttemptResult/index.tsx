import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import type { Attempt, ReevaluationRequestView, StudentNotification, StudentResultAnalysis } from "@/api/types";
import { getAttemptMetrics } from "@/pages/student/attemptMetrics";
import { attemptResultStrings as strings } from "./AttemptResult.strings";
import { PerformanceOverviewPanel } from "./components/PerformanceOverviewPanel";
import { AnalysisPanel } from "./components/AnalysisPanel";
import { ReevaluationStatus } from "./components/ReevaluationStatus";
import { ReevaluationRequestForm } from "./components/ReevaluationRequestForm";
import { Badge, Button, LinkButton, Modal } from "@/components/ui";

// AI auto-grading runs as a background job right after submission (a
// provider call can take a while), so a freshly submitted human-graded
// attempt is polled briefly for the result to land - either a real grade or
// the quota-exhausted notification that fires when it can't run.
const AI_GRADING_POLL_INTERVAL_MS = 4000;
const AI_GRADING_POLL_MAX_ATTEMPTS = 15;

export function AttemptResult() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [analysis, setAnalysis] = useState<StudentResultAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState(false);
  const [reviewReason, setReviewReason] = useState("");
  const [requestingReview, setRequestingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [quotaExhaustedModalOpen, setQuotaExhaustedModalOpen] = useState(false);
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

  const hasHumanGradedPart = attempt?.parts.some((part) => !part.auto_marked) ?? false;
  const awaitingAiGrading = attempt?.status === "grading" && hasHumanGradedPart;

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
          setAttempt(data);
          if (data.status !== "grading") window.clearInterval(timer);
        })
        .catch(() => {});
      apiClient
        .get<StudentNotification[]>("/notifications", { headers: { "X-Skip-Loader": "1" } })
        .then(({ data }) => {
          if (!active) return;
          const exhausted = data.some(
            (item) => item.kind === "ai_quota_exhausted" && item.created_at >= mountedAtRef.current,
          );
          if (exhausted) {
            setQuotaExhaustedModalOpen(true);
            window.clearInterval(timer);
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
  const canRequestReview = ["grading", "graded"].includes(attempt.status) && hasInstructorReviewablePart && !attempt.reevaluation;
  const isAiGraded = attempt.parts.some((part) => part.grade?.status === "ai_graded");
  const statusLabels = strings.statusLabels;
  const q = strings.quotaExhaustedModal;

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

  return (
    <div className="result-overview-page">
      <div className="page-header result-page-header">
        <div>
          <span className="page-eyebrow">{strings.eyebrow}</span>
          <h1>{attempt.module_title}</h1>
          <p className="page-subtitle">
            {statusLabels[attempt.status as keyof typeof statusLabels] ?? attempt.status}
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

      <Modal
        open={quotaExhaustedModalOpen}
        onClose={() => setQuotaExhaustedModalOpen(false)}
        title={q.title}
        actions={
          <>
            <Button variant="secondary" onClick={() => setQuotaExhaustedModalOpen(false)}>
              {q.dismiss}
            </Button>
            <Button
              onClick={() => navigate("/student/support?category=ai_evaluation&subject=AI+evaluation+quota+reached")}
            >
              {q.contactSupport}
            </Button>
          </>
        }
      >
        <p>{q.body}</p>
      </Modal>

      <PerformanceOverviewPanel attempt={attempt} metrics={metrics} />
      <AnalysisPanel analysis={analysis} analysisError={analysisError} />

      {attempt.reevaluation && <ReevaluationStatus reevaluation={attempt.reevaluation} />}

      {canRequestReview && (
        <ReevaluationRequestForm
          reviewReason={reviewReason}
          onReviewReasonChange={setReviewReason}
          requesting={requestingReview}
          reviewError={reviewError}
          onSubmit={requestInstructorReview}
        />
      )}
    </div>
  );
}
