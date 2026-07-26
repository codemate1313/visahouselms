import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { instituteAiQuotaStrings as strings } from "./InstituteAiQuota.strings";
import type { AiQuotaOverview } from "./types";

export type { AiQuotaOverview, AiQuotaStudent } from "./types";

export function InstituteAiQuota() {
  const [data, setData] = useState<AiQuotaOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<AiQuotaOverview>("/institute/ai-quota")
      .then((response) => setData(response.data))
      .catch(() => setError(strings.loadError));
  }, []);

  if (error) return <p className="error-text">{error}</p>;
  if (!data) return <p>{strings.loading}</p>;

  const t = strings.table;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{strings.title}</h1>
          <p className="page-subtitle">{strings.subtitle}</p>
        </div>
      </div>

      <div className="ai-quota-cards">
        <div className="ai-quota-card">
          <span className="ai-quota-card-label">{strings.perStudent.label}</span>
          <strong className="ai-quota-card-value">{data.per_student_limit}</strong>
          <small>
            {data.limit_source === "platform" ? strings.perStudent.platformHint : strings.perStudent.suffix}
          </small>
        </div>
        <div className="ai-quota-card">
          <span className="ai-quota-card-label">{strings.totalUsed.label}</span>
          <strong className="ai-quota-card-value">{data.total_used}</strong>
          <small>{strings.totalUsed.suffix}</small>
        </div>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>{t.student}</th>
            <th>{t.used}</th>
            <th>{t.remaining}</th>
            <th>{t.status}</th>
          </tr>
        </thead>
        <tbody>
          {!data.students.length ? (
            <tr>
              <td colSpan={4}>{t.empty}</td>
            </tr>
          ) : (
            data.students.map((student) => (
              <tr key={student.user_id}>
                <td>
                  <strong>{student.name}</strong>
                  <small style={{ display: "block" }}>{student.email}</small>
                </td>
                <td>{student.used} / {student.limit}</td>
                <td>{student.remaining}</td>
                <td>
                  <span className={`badge ${student.exhausted ? "badge-red" : "badge-green"}`}>
                    {student.exhausted ? t.exhausted : t.ok}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <p className="hint" style={{ marginTop: 16 }}>{strings.readOnlyNote}</p>
    </div>
  );
}
