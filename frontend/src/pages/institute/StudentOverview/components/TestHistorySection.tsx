import type { AttemptRecord } from "../types";
import { studentOverviewStrings as strings } from "../StudentOverview.strings";

function dateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : "-";
}

interface TestHistorySectionProps {
  attempts: AttemptRecord[];
}

export function TestHistorySection({ attempts }: TestHistorySectionProps) {
  const t = strings.testHistory;
  return (
    <section className="student-record-section">
      <div className="section-heading">
        <div>
          <span className="page-eyebrow">{t.eyebrow}</span>
          <h2>{t.heading}</h2>
        </div>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t.test}</th>
              <th>{t.started}</th>
              <th>{t.status}</th>
              <th>{t.score}</th>
              <th>{t.checkedBy}</th>
            </tr>
          </thead>
          <tbody>
            {attempts.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-cell">
                  {t.empty}
                </td>
              </tr>
            ) : (
              attempts.map((attempt) => (
                <tr key={attempt.id}>
                  <td>
                    <strong>{attempt.module_title}</strong>
                    <span className="device-agent">{attempt.module_type.replaceAll("_", " ")}</span>
                  </td>
                  <td>{dateTime(attempt.started_at)}</td>
                  <td>
                    <span className="badge">{attempt.status.replaceAll("_", " ")}</span>
                  </td>
                  <td>{attempt.raw_score !== null ? `${attempt.raw_score} / ${attempt.max_score ?? "-"}` : t.pending}</td>
                  <td>
                    {attempt.graders.length ? (
                      <div className="grader-list">
                        {attempt.graders.map((grader, index) => (
                          <span key={`${grader.id}-${grader.part}-${index}`}>
                            <strong>{grader.name}</strong> · {grader.part}
                          </span>
                        ))}
                      </div>
                    ) : attempt.status === "graded" ? (
                      t.autoGraded
                    ) : (
                      t.awaitingGrading
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
