import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../api/client";
import type { AttemptSummary } from "../../api/types";

const STATUS_CLASS: Record<string, string> = {
  in_progress: "badge-amber",
  submitted: "badge-gray",
  grading: "badge-amber",
  graded: "badge-green",
  expired: "badge-red",
};
const STATUS_LABEL: Record<string, string> = {
  in_progress: "In progress",
  submitted: "Submitted",
  grading: "Awaiting grading",
  graded: "Graded",
  expired: "Expired",
};

export function StudentAttempts() {
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<AttemptSummary[]>("/student/attempts")
      .then(({ data }) => setAttempts(data))
      .catch(() => setError("Failed to load your test history."))
      .finally(() => setLoading(false));
  }, []);

  if (error) return <p className="error-text">{error}</p>;
  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <div className="page-header">
        <div><span className="page-eyebrow">History</span><h1>My Test History</h1><p className="page-subtitle">Every attempt you've started, submitted, or completed.</p></div>
      </div>
      {attempts.length === 0 ? (
        <div className="empty-state"><h2>No attempts yet</h2><p>Start a test from My Courses.</p></div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Module</th><th>Status</th><th>Started</th><th>Score</th><th>Band</th><th></th></tr></thead>
            <tbody>
              {attempts.map((attempt) => (
                <tr key={attempt.id} className="clickable">
                  <td>{attempt.module_title}</td>
                  <td><span className={`badge ${STATUS_CLASS[attempt.status] ?? "badge-gray"}`}>{STATUS_LABEL[attempt.status] ?? attempt.status}</span></td>
                  <td>{new Date(attempt.started_at).toLocaleString()}</td>
                  <td>{attempt.raw_score && attempt.max_score ? `${attempt.raw_score} / ${attempt.max_score}` : "—"}</td>
                  <td>{attempt.band_label ?? "—"}</td>
                  <td className="table-actions">
                    {attempt.status === "in_progress" ? (
                      <Link to={`/student/attempts/${attempt.id}/take`}>Resume</Link>
                    ) : (
                      <Link to={`/student/attempts/${attempt.id}/result`}>View</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
