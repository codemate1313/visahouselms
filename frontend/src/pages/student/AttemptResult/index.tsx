import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import type { Attempt, ReevaluationRequestView, StudentResultAnalysis } from "@/api/types";
import { getAttemptMetrics } from "@/pages/student/attemptMetrics";
import { attemptResultStrings as strings } from "./AttemptResult.strings";
import { PerformanceOverviewPanel } from "./components/PerformanceOverviewPanel";
import { AnalysisPanel } from "./components/AnalysisPanel";
import { ReevaluationStatus } from "./components/ReevaluationStatus";
import { ReevaluationRequestForm } from "./components/ReevaluationRequestForm";

export function AttemptResult() {
  const { id } = useParams();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [analysis, setAnalysis] = useState<StudentResultAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState(false);
  const [reviewReason, setReviewReason] = useState("");
  const [requestingReview, setRequestingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

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

  const metrics = useMemo(() => attempt ? getAttemptMetrics(attempt) : null, [attempt]);

  if (error && !attempt) return <p className="error-text">{error}</p>;
  if (!attempt || !metrics) return <p>{strings.loading}</p>;

  const hasInstructorReviewablePart = attempt.parts.some((part) => !part.auto_marked);
  const canRequestReview = ["grading", "graded"].includes(attempt.status) && hasInstructorReviewablePart && !attempt.reevaluation;
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

  return (
    <div className="result-overview-page">
      <div className="page-header result-page-header">
        <div>
          <span className="page-eyebrow">{strings.eyebrow}</span>
          <h1>{attempt.module_title}</h1>
          <p className="page-subtitle">{statusLabels[attempt.status as keyof typeof statusLabels] ?? attempt.status}</p>
        </div>
        <Link className="button-link" to="/student/attempts">
          {strings.allAttempts}
        </Link>
      </div>

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
