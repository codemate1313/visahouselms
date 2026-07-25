import { type FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import type { Attempt } from "@/api/types";
import { getAttemptMetrics } from "@/pages/student/attemptMetrics";
import { attemptResultDetailsStrings as strings } from "./AttemptResultDetails.strings";
import { ResultDetailStats } from "./components/ResultDetailStats";
import { CefrProfilePanel } from "./components/CefrProfilePanel";
import { PartReviewSection } from "./components/PartReviewSection";
import { ReevaluationStatus } from "./components/ReevaluationStatus";
import { ReevaluationForm } from "./components/ReevaluationForm";

export function AttemptResultDetails() {
  const { id } = useParams();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    apiClient
      .get<Attempt>(`/student/attempts/${id}`)
      .then(({ data }) => setAttempt(data))
      .catch(() => setError(strings.loadError));
  }, [id]);

  if (error && !attempt) return <p className="error-text">{error}</p>;
  if (!attempt) return <p>{strings.loading}</p>;

  const graded = attempt.status === "graded";
  const reviewable = ["grading", "graded"].includes(attempt.status);
  const profile = attempt.cefr_profile;
  const metrics = getAttemptMetrics(attempt);
  const canRequestReevaluation = reviewable && attempt.parts.some((part) => !part.auto_marked) && !attempt.reevaluation;
  const statusLabels = strings.statusLabels;

  async function requestReevaluation(event: FormEvent) {
    event.preventDefault();
    if (!attempt) return;
    setRequesting(true);
    try {
      const { data } = await apiClient.post(`/student/attempts/${attempt.id}/reevaluation`, { reason });
      setAttempt((current) => current ? { ...current, reevaluation: data } : current);
      setReason("");
      setError(null);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.reevaluation.errors.submit));
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="attempt-detail-page">
      <div className="page-header">
        <div>
          <span className="page-eyebrow">{strings.eyebrow}</span>
          <h1>{attempt.module_title}</h1>
          <p className="page-subtitle">{statusLabels[attempt.status as keyof typeof statusLabels] ?? attempt.status}</p>
        </div>
        <div className="result-header-actions">
          <Link className="secondary-button button-link" to={`/student/attempts/${attempt.id}/result`}>
            {strings.resultOverview}
          </Link>
          <Link className="button-link" to="/student/attempts">
            {strings.allAttempts}
          </Link>
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}

      <ResultDetailStats metrics={metrics} />

      {profile && <CefrProfilePanel profile={profile} />}

      {attempt.parts.map((part) => (
        <PartReviewSection key={part.id} part={part} />
      ))}

      {!graded && attempt.status !== "expired" && <p className="hint">{strings.scoreUpdateHint}</p>}

      {attempt.reevaluation && <ReevaluationStatus reevaluation={attempt.reevaluation} />}

      {canRequestReevaluation && (
        <ReevaluationForm reason={reason} onReasonChange={setReason} requesting={requesting} onSubmit={requestReevaluation} />
      )}
    </div>
  );
}
