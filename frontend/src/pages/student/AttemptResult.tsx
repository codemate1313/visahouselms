import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiClient } from "../../api/client";
import type { Attempt } from "../../api/types";

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

  useEffect(() => {
    apiClient
      .get<Attempt>(`/student/attempts/${id}`)
      .then(({ data }) => setAttempt(data))
      .catch(() => setError("Failed to load this result."));
  }, [id]);

  if (error) return <p className="error-text">{error}</p>;
  if (!attempt) return <p>Loading...</p>;

  const graded = attempt.status === "graded";

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

      <div className="stat-tile-row">
        <div className="stat-tile"><p className="stat-label">Score</p><p className="stat-value">{attempt.raw_score && attempt.max_score ? `${attempt.raw_score} / ${attempt.max_score}` : "Pending"}</p></div>
        <div className="stat-tile"><p className="stat-label">Band</p><p className="stat-value">{attempt.band_label ?? "—"}</p></div>
        <div className="stat-tile"><p className="stat-label">Submitted</p><p className="stat-value">{attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleDateString() : "—"}</p></div>
        {attempt.flag_count > 0 && <div className="stat-tile"><p className="stat-label">Proctoring flags</p><p className="stat-value due-text">{attempt.flag_count}</p></div>}
      </div>

      {attempt.parts.map((part) => (
        <section className="workspace-panel" key={part.id} style={{ marginBottom: 16 }}>
          <div className="panel-heading"><div><h2>{part.title}</h2><p>{part.skill_focus}</p></div>{part.max_marks && <strong>{part.auto_marked ? `${part.questions.reduce((s, q) => s + Number(q.points_awarded ?? 0), 0)} / ${part.max_marks}` : part.grade?.total_marks ? `${part.grade.total_marks} / ${part.max_marks}` : "Pending"}</strong>}</div>

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
                    <div><strong>{criterion.criterion}</strong><span>{criterion.marks_awarded}/{criterion.max_marks}</span></div>
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
    </div>
  );
}
