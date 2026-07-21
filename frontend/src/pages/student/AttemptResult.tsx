import { type FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiClient } from "../../api/client";
import type { Attempt } from "../../api/types";
import { extractErrorMessage } from "../../api/errors";

const STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted — auto-grading",
  grading: "Awaiting instructor grading",
  graded: "Graded",
  expired: "Expired before submission",
};

export function AttemptResult() {
  const { id } = useParams();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    apiClient
      .get<Attempt>(`/student/attempts/${id}`)
      .then(({ data }) => setAttempt(data))
      .catch(() => setError("Failed to load this result."));
  }, [id]);

  if (error && !attempt) return <p className="error-text">{error}</p>;
  if (!attempt) return <p>Loading...</p>;

  const graded = attempt.status === "graded";
  const profile = attempt.cefr_profile;
  const canRequestReevaluation = graded && attempt.parts.some((part) => !part.auto_marked) && !attempt.reevaluation;

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
      setError(extractErrorMessage(err, "Failed to submit your reevaluation request."));
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="page-eyebrow">Result</span>
          <h1>{attempt.module_title}</h1>
          <p className="page-subtitle">{STATUS_LABEL[attempt.status] ?? attempt.status}</p>
        </div>
        <Link className="button-link" to="/student/attempts">← All attempts</Link>
      </div>
      {error && <p className="error-text">{error}</p>}

      <div className="stat-tile-row">
        <div className="stat-tile"><p className="stat-label">Score</p><p className="stat-value">{attempt.raw_score && attempt.max_score ? `${attempt.raw_score} / ${attempt.max_score}` : "Pending"}</p></div>
        <div className="stat-tile"><p className="stat-label">Band</p><p className="stat-value">{attempt.band_label ?? "—"}</p></div>
        <div className="stat-tile"><p className="stat-label">Submitted</p><p className="stat-value">{attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleDateString() : "—"}</p></div>
        {attempt.flag_count > 0 && <div className="stat-tile"><p className="stat-label">Proctoring flags</p><p className="stat-value due-text">{attempt.flag_count}</p></div>}
      </div>

      {profile && (
        <section className="cefr-result" aria-labelledby="cefr-result-title">
          <div className="cefr-result-header">
            <div>
              <span className="page-eyebrow">{profile.framework_version}</span>
              <h2 id="cefr-result-title">CEFR proficiency profile</h2>
              <p>{profile.overall?.descriptor ?? "Your final CEFR profile will be available when every assessed skill has been graded."}</p>
            </div>
            <div className={`cefr-overall ${profile.overall ? "is-complete" : "is-pending"}`}>
              <span>Overall</span>
              <strong>{profile.overall?.label ?? "Pending"}</strong>
            </div>
          </div>

          <div className="cefr-skill-grid">
            {profile.skills.map((skill) => (
              <article key={skill.skill} className={skill.status === "pending" ? "is-pending" : ""}>
                <div className="cefr-skill-heading">
                  <div><span>{skill.label}</span><strong>{skill.level_label}</strong></div>
                  <span>{skill.status === "complete" ? `${skill.percentage}%` : "Awaiting examiner"}</span>
                </div>
                <div className="cefr-meter" aria-label={`${skill.label} ${skill.percentage}%`}>
                  <span style={{ width: `${Math.min(100, Number(skill.percentage))}%` }} />
                </div>
                <p>{skill.descriptor}</p>
                <small>{skill.raw_score} / {skill.max_score} marks</small>
              </article>
            ))}
          </div>

          <div className="cefr-result-note">
            <p>{profile.calibration_note}</p>
            <a href={profile.source_url} target="_blank" rel="noreferrer">Council of Europe framework source</a>
          </div>
        </section>
      )}

      {attempt.parts.map((part) => (
        <section className="workspace-panel" key={part.id} style={{ marginBottom: 16 }}>
          <div className="panel-heading"><div><h2>{part.title}</h2><p>{part.skill_focus}</p></div>{(part.max_marks || part.rubric.length > 0) && <strong>{part.auto_marked ? `${part.questions.reduce((s, q) => s + Number(q.points_awarded ?? 0), 0)} / ${part.max_marks}` : part.grade?.total_marks ? `${part.grade.total_marks} / ${part.rubric.reduce((sum, item) => sum + Number(item.max_marks), 0)}` : "Pending"}</strong>}</div>

          {part.auto_marked ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Question</th><th>Your answer</th><th>Correct answer</th><th>Result</th></tr></thead>
                <tbody>
                  {part.questions.map((question, index) => (
                    <tr key={question.id}>
                      <td>{index + 1}. {question.prompt}</td>
                      <td>{question.response?.selected ? (Array.isArray(question.response.selected) ? question.response.selected.join(", ") : question.response.selected) : question.response?.text ?? "—"}</td>
                      <td>{question.correct_answers?.join(", ") ?? "—"}</td>
                      <td><span className={`badge ${question.is_correct ? "badge-green" : "badge-red"}`}>{question.is_correct ? "Correct" : "Incorrect"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : part.grade ? (
            <div className="rubric-details">
              <div className="rubric-grid">
                {part.grade.criteria.map((criterion) => (
                  <article key={criterion.criterion}>
                    <div><strong>{criterion.criterion}</strong><span>{criterion.cefr_level} - {criterion.marks_awarded}/{criterion.max_marks}</span></div>
                  </article>
                ))}
              </div>
              {part.grade.comment && <p className="hint">Examiner comment: {part.grade.comment}</p>}
            </div>
          ) : (
            <p className="empty-message">Your instructor hasn't graded this part yet.</p>
          )}
        </section>
      ))}

      {!graded && attempt.status !== "expired" && (
        <p className="hint">Your final score will update once every part has been graded.</p>
      )}

      {attempt.reevaluation && <section className="workspace-panel reevaluation-status"><div className="panel-heading"><div><span className="page-eyebrow">Result review</span><h2>Reevaluation request</h2></div><span className={`badge ${attempt.reevaluation.status === "resolved" ? "badge-green" : attempt.reevaluation.status === "rejected" ? "badge-red" : "badge-amber"}`}>{attempt.reevaluation.status.replace("_", " ")}</span></div><p>{attempt.reevaluation.reason}</p>{attempt.reevaluation.assigned_to_name && <p className="hint">Reviewer: {attempt.reevaluation.assigned_to_name}</p>}{attempt.reevaluation.resolution_note && <div className="banner"><strong>Resolution</strong> {attempt.reevaluation.resolution_note}</div>}</section>}

      {canRequestReevaluation && <form className="workspace-panel reevaluation-form" onSubmit={requestReevaluation}><div className="panel-heading"><div><span className="page-eyebrow">Need another review?</span><h2>Request reevaluation</h2><p>Explain the specific rubric mark or feedback you would like an instructor to review.</p></div></div><label htmlFor="reevaluation-reason">Reason for review</label><textarea id="reevaluation-reason" rows={4} minLength={20} maxLength={2000} required value={reason} onChange={(event) => setReason(event.target.value)} /><div className="form-actions"><button disabled={requesting || reason.trim().length < 20}>{requesting ? "Submitting..." : "Submit reevaluation request"}</button></div></form>}
    </div>
  );
}
