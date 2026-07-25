import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "@/api/client";
import type { AttemptSummary } from "@/api/types";
import { Icon } from "@/components/icons";
import { studentAttemptsStrings as strings } from "./StudentAttempts.strings";

const STATUS_CLASS: Record<string, string> = {
  ready: "badge-blue",
  in_progress: "badge-amber",
  submitted: "badge-gray",
  grading: "badge-amber",
  graded: "badge-green",
  expired: "badge-red",
};

export function StudentAttempts() {
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<AttemptSummary[]>("/student/attempts")
      .then(({ data }) => setAttempts(data))
      .catch(() => setError(strings.loadError))
      .finally(() => setLoading(false));
  }, []);

  if (error) return <p className="error-text">{error}</p>;
  if (loading) return <p>{strings.loading}</p>;

  const statusLabels = strings.statusLabels;

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="page-eyebrow">{strings.eyebrow}</span>
          <h1>{strings.title}</h1>
          <p className="page-subtitle">{strings.subtitle}</p>
        </div>
      </div>
      {attempts.length === 0 ? (
        <div className="empty-state">
          <h2>{strings.empty.title}</h2>
          <p>{strings.empty.description}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{strings.table.module}</th>
                <th>{strings.table.status}</th>
                <th>{strings.table.started}</th>
                <th>{strings.table.score}</th>
                <th>{strings.table.band}</th>
                <th className="table-actions-heading">{strings.table.actions}</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((attempt) => (
                <tr key={attempt.id} className="clickable">
                  <td>{attempt.module_title}</td>
                  <td>
                    <span className={`badge ${STATUS_CLASS[attempt.status] ?? "badge-gray"}`}>
                      {statusLabels[attempt.status as keyof typeof statusLabels] ?? attempt.status}
                    </span>
                  </td>
                  <td>{new Date(attempt.started_at).toLocaleString()}</td>
                  <td>{attempt.raw_score && attempt.max_score ? `${attempt.raw_score} / ${attempt.max_score}` : "—"}</td>
                  <td>{attempt.band_label ?? "—"}</td>
                  <td className="table-actions">
                    {attempt.status === "ready" || attempt.status === "in_progress" ? (
                      <Link to={`/student/attempts/${attempt.id}/take`} aria-label={strings.resumeTest} data-tooltip={strings.resumeTest}>
                        <Icon name="module" />
                      </Link>
                    ) : (
                      <Link to={`/student/attempts/${attempt.id}/result`} aria-label={strings.viewResult} data-tooltip={strings.viewResult}>
                        <Icon name="overview" />
                      </Link>
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
