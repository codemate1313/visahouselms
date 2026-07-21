import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { API_BASE_URL, apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import type { AiEvaluationSuggestion, AttemptPart, GradingDetail as GradingDetailType } from "../../api/types";
import { useAuthStore } from "../../store/authStore";
import { useToastStore } from "../../store/toastStore";

function levelForMarks(value: string, maximum: number) {
  if (value === "" || maximum <= 0) return "Not scored";
  const percentage = (Number(value) / maximum) * 100;
  if (percentage >= 90) return "C2";
  if (percentage >= 75) return "C1";
  if (percentage >= 60) return "B2";
  if (percentage >= 40) return "B1";
  return "Below B1";
}

function PartGradingCard({ part, attemptId, canEdit, aiConfigured, onGraded }: {
  part: AttemptPart;
  attemptId: string;
  canEdit: boolean;
  aiConfigured: boolean;
  onGraded: (detail: GradingDetailType) => void;
}) {
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);
  const [marks, setMarks] = useState<Record<string, string>>(() => Object.fromEntries(part.rubric.map((criterion) => [criterion.criterion, part.grade?.criteria.find((item) => item.criterion === criterion.criterion)?.marks_awarded ?? ""])));
  const [comment, setComment] = useState(part.grade?.comment ?? "");
  const [suggestion, setSuggestion] = useState<AiEvaluationSuggestion | null>(null);
  const [saving, setSaving] = useState(false);
  const [requestingAi, setRequestingAi] = useState(false);
  const allScored = part.rubric.every((criterion) => marks[criterion.criterion] !== "");
  const supportsAi = part.section_type === "writing";

  async function requestAiSuggestion() {
    setRequestingAi(true);
    try {
      const { data } = await apiClient.post<AiEvaluationSuggestion>(`/instructor/grading/${attemptId}/parts/${part.id}/ai-suggestion`);
      setSuggestion(data);
      setMarks(Object.fromEntries(data.criteria.map((item) => [item.criterion, item.marks_awarded])));
      setComment(data.comment);
      showSuccess("AI draft loaded for human review.", "Draft Ready");
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Failed to generate an assisted evaluation."), "AI Assistance Failed");
    } finally {
      setRequestingAi(false);
    }
  }

  async function submitGrade() {
    setSaving(true);
    try {
      const criteria = part.rubric.map((criterion) => ({ criterion: criterion.criterion, marks_awarded: Number(marks[criterion.criterion] || 0) }));
      const { data } = await apiClient.post<GradingDetailType>(`/instructor/grading/${attemptId}/parts/${part.id}`, { criteria, comment: comment || undefined });
      onGraded(data);
      showSuccess(`${part.title} graded.`, "Saved");
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Failed to save the grade."), "Grading Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="workspace-panel grading-part-panel">
      <div className="panel-heading"><div><h2>{part.title}</h2><p>{part.skill_focus}</p></div><div className="form-actions">{part.grade?.status === "graded" && <span className="badge badge-green">Graded</span>}{canEdit && supportsAi && <button type="button" className="secondary-button" disabled={!aiConfigured || requestingAi} onClick={requestAiSuggestion}>{requestingAi ? "Generating..." : "AI rubric draft"}</button>}</div></div>
      {canEdit && supportsAi && !aiConfigured && <p className="hint">AI assistance is disabled. A Super Admin can configure the evaluator in Developer Settings.</p>}
      {!supportsAi && <p className="hint">Speaking recordings require human listening and are not sent to the text evaluator.</p>}

      {part.questions.map((question) => <div key={question.id} className="test-runner-question grading-response"><p className="test-runner-prompt">{question.prompt}</p>{question.audio_path ? <audio controls src={`${API_BASE_URL}${question.audio_path}`} /> : <p className="hint">{question.response?.text || "No response submitted."}</p>}</div>)}

      {suggestion && <div className="ai-review-banner"><div><strong>Advisory AI draft</strong><p>Confidence {Math.round(Number(suggestion.confidence) * 100)}%. Review every mark before saving; the model cannot publish this result.</p></div>{suggestion.criteria.map((item) => <p key={item.criterion}><strong>{item.criterion}:</strong> {item.rationale || "No rationale returned."}</p>)}</div>}

      <details className="rubric-details" open>
        <summary>CEFR assessment criteria - {part.rubric.length} criteria</summary>
        <div className="cefr-anchor-scale" aria-label="CEFR scoring anchors">{part.cefr_scale.map((anchor) => <div key={anchor.level}><strong>{anchor.level}</strong><span>{anchor.marks}</span><p>{anchor.descriptor}</p></div>)}</div>
        <div className="rubric-grid">{part.rubric.map((criterion) => <article key={criterion.criterion}><div><strong>{criterion.criterion}</strong><span className="cefr-mark-level">{levelForMarks(marks[criterion.criterion], criterion.max_marks)}</span></div><p>{criterion.description}</p><label htmlFor={`criterion-${part.id}-${criterion.criterion}`}>Mark from 0 to {criterion.max_marks}</label><input id={`criterion-${part.id}-${criterion.criterion}`} type="number" min={0} max={criterion.max_marks} step={0.5} value={marks[criterion.criterion]} disabled={!canEdit} onChange={(event) => setMarks((current) => ({ ...current, [criterion.criterion]: event.target.value }))} /></article>)}</div>
      </details>
      <label htmlFor={`comment-${part.id}`}>Examiner comment (optional)</label><textarea id={`comment-${part.id}`} rows={3} value={comment} disabled={!canEdit} onChange={(event) => setComment(event.target.value)} />
      {canEdit && <div className="form-actions"><button onClick={submitGrade} disabled={saving || !allScored}>{saving ? "Saving..." : "Confirm human CEFR evaluation"}</button></div>}
    </section>
  );
}

export function GradingDetail() {
  const { id } = useParams();
  const user = useAuthStore((state) => state.user);
  const isInstituteInstructor = user?.role === "INST_INSTRUCTOR";
  const [detail, setDetail] = useState<GradingDetailType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [busy, setBusy] = useState(false);

  function load() { apiClient.get<GradingDetailType>(`/instructor/grading/${id}`).then(({ data }) => { setDetail(data); setError(null); }).catch(() => setError("Failed to load this submission.")); }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function queueAction(action: "claim" | "release") {
    setBusy(true);
    try { await apiClient.post(`/instructor/grading/${id}/${action}`); load(); } catch (err: unknown) { setError(extractErrorMessage(err, `Failed to ${action} this submission.`)); } finally { setBusy(false); }
  }

  async function resolve(resolution: "resolved" | "rejected") {
    setBusy(true);
    try { await apiClient.post(`/instructor/grading/${id}/reevaluation/resolve`, { resolution, note: resolutionNote }); load(); } catch (err: unknown) { setError(extractErrorMessage(err, "Failed to resolve the reevaluation.")); } finally { setBusy(false); }
  }

  if (error && !detail) return <p className="error-text">{error}</p>;
  if (!detail) return <p>Loading...</p>;
  const subjectiveParts = detail.parts.filter((part) => !part.auto_marked);
  const claimedByMe = detail.queue.assigned_to_id === user?.id;
  const claimedByOther = detail.queue.assigned_to_id != null && !claimedByMe;
  const hasOpenReevaluation = detail.reevaluation && ["pending", "in_review"].includes(detail.reevaluation.status);
  const canEdit = !claimedByOther && (detail.queue.status !== "completed" || Boolean(hasOpenReevaluation));

  return <div>
    <div className="page-header"><div><span className="page-eyebrow">{detail.queue.routing_reason.replaceAll("_", " ")}</span><h1>{detail.student_name}</h1><p className="page-subtitle">{detail.module_title} · {detail.student_email}</p></div><div className="page-header-actions">{detail.queue.status === "pending" && <button disabled={busy} onClick={() => queueAction("claim")}>Claim submission</button>}{claimedByMe && detail.queue.status === "claimed" && <button className="secondary-button" disabled={busy} onClick={() => queueAction("release")}>Release</button>}<Link className="button-link secondary-button" to={isInstituteInstructor ? "/institute-instructor/grading" : "/super-admin/instructor/grading"}>Back to queue</Link></div></div>
    {error && <p className="error-text">{error}</p>}
    <div className="cefr-grading-note"><strong>CEFR Companion Volume 2020</strong><p>Human examiner approval is required for every subjective result. AI suggestions are advisory and retained separately for audit.</p></div>
    {claimedByOther && <div className="banner"><strong>Read only</strong> This submission is claimed by {detail.queue.assigned_to_name}.</div>}
    {hasOpenReevaluation && <section className="workspace-panel reevaluation-review"><div className="panel-heading"><div><span className="badge badge-red">Reevaluation</span><h2>Student review request</h2></div></div><p>{detail.reevaluation?.reason}</p><label htmlFor="resolution-note">Resolution note</label><textarea id="resolution-note" rows={3} value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} placeholder="Explain what was reviewed and whether the result changed." />{canEdit && <div className="form-actions"><button disabled={busy || resolutionNote.trim().length < 10} onClick={() => resolve("resolved")}>Resolve after review</button><button className="secondary-button" disabled={busy || resolutionNote.trim().length < 10} onClick={() => resolve("rejected")}>Reject request</button></div>}</section>}
    {detail.flags.length > 0 && <section className="workspace-panel"><div className="panel-heading"><div><h2>Proctoring flags</h2><p>Informational signals recorded during this attempt.</p></div></div><ul className="activity-list">{detail.flags.map((flag, index) => <li key={index}><span>{flag.flag_type.replace("_", " ")}</span><time>{new Date(flag.occurred_at).toLocaleString()}</time></li>)}</ul></section>}
    {subjectiveParts.map((part) => <PartGradingCard key={part.id} part={part} attemptId={id!} canEdit={canEdit} aiConfigured={detail.ai_assistance.configured} onGraded={setDetail} />)}
  </div>;
}
