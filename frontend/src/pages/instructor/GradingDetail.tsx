import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { API_BASE_URL, apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import type { AttemptPart, GradingDetail as GradingDetailType } from "../../api/types";
import { useToastStore } from "../../store/toastStore";

function PartGradingCard({
  part,
  attemptId,
  onGraded,
}: {
  part: AttemptPart;
  attemptId: string;
  onGraded: (detail: GradingDetailType) => void;
}) {
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);
  const [marks, setMarks] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const criterion of part.rubric) {
      const existing = part.grade?.criteria.find((c) => c.criterion === criterion.criterion);
      initial[criterion.criterion] = existing?.marks_awarded ?? "";
    }
    return initial;
  });
  const [comment, setComment] = useState(part.grade?.comment ?? "");
  const [saving, setSaving] = useState(false);

  async function submitGrade() {
    setSaving(true);
    try {
      const criteria = part.rubric.map((criterion) => ({
        criterion: criterion.criterion,
        marks_awarded: Number(marks[criterion.criterion] || 0),
      }));
      const { data } = await apiClient.post<GradingDetailType>(
        `/instructor/grading/${attemptId}/parts/${part.id}`,
        { criteria, comment: comment || undefined },
      );
      onGraded(data);
      showSuccess(`${part.title} graded.`, "Saved");
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Failed to save the grade."), "Grading Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="workspace-panel" style={{ marginBottom: 16 }}>
      <div className="panel-heading"><div><h2>{part.title}</h2><p>{part.skill_focus}</p></div>{part.grade?.status === "graded" && <span className="badge badge-green">Graded</span>}</div>

      {part.questions.map((question) => (
        <div key={question.id} className="test-runner-question" style={{ marginBottom: 12 }}>
          <p className="test-runner-prompt">{question.prompt}</p>
          {question.audio_path ? (
            <audio controls src={`${API_BASE_URL}${question.audio_path}`} />
          ) : (
            <p className="hint">{question.response?.text || "No response submitted."}</p>
          )}
        </div>
      ))}

      <details className="rubric-details" open>
        <summary>Assessment criteria — {part.rubric.length} criteria</summary>
        <div className="rubric-grid">
          {part.rubric.map((criterion) => (
            <article key={criterion.criterion}>
              <div><strong>{criterion.criterion}</strong><span>0–{criterion.max_marks}</span></div>
              <p>{criterion.description}</p>
              <input
                type="number"
                min={0}
                max={criterion.max_marks}
                step={0.5}
                value={marks[criterion.criterion]}
                onChange={(e) => setMarks((current) => ({ ...current, [criterion.criterion]: e.target.value }))}
              />
            </article>
          ))}
        </div>
      </details>
      <label htmlFor={`comment-${part.id}`}>Examiner comment (optional)</label>
      <textarea id={`comment-${part.id}`} rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
      <div className="form-actions">
        <button onClick={submitGrade} disabled={saving}>{saving ? "Saving..." : "Save grade"}</button>
      </div>
    </section>
  );
}

export function GradingDetail() {
  const { id } = useParams();
  const [detail, setDetail] = useState<GradingDetailType | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    apiClient
      .get<GradingDetailType>(`/instructor/grading/${id}`)
      .then(({ data }) => setDetail(data))
      .catch(() => setError("Failed to load this submission."));
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  if (error) return <p className="error-text">{error}</p>;
  if (!detail) return <p>Loading...</p>;

  const subjectiveParts = detail.parts.filter((part) => !part.auto_marked);

  return (
    <div>
      <div className="page-header">
        <div><h1>{detail.student_name}</h1><p className="page-subtitle">{detail.module_title} · {detail.student_email}</p></div>
        <Link className="button-link" to="/super-admin/instructor/grading">← Grading queue</Link>
      </div>

      {detail.flags.length > 0 && (
        <div className="workspace-panel" style={{ marginBottom: 16 }}>
          <div className="panel-heading"><div><h2>Proctoring flags</h2><p>Logged during this attempt — informational only.</p></div></div>
          <ul className="activity-list">
            {detail.flags.map((flag, index) => (
              <li key={index}><span>{flag.flag_type.replace("_", " ")}</span><time>{new Date(flag.occurred_at).toLocaleString()}</time></li>
            ))}
          </ul>
        </div>
      )}

      {subjectiveParts.map((part) => (
        <PartGradingCard key={part.id} part={part} attemptId={id!} onGraded={setDetail} />
      ))}
    </div>
  );
}
