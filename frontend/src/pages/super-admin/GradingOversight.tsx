import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import type { GradingAdminOverview } from "@/api/types";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { gradingOversightStrings as strings } from "./GradingOversight.strings";

const STATUS_CLASS: Record<string, string> = { pending: "badge-amber", in_review: "badge-blue", resolved: "badge-green", rejected: "badge-red" };

export function GradingOversight() {
  const [overview, setOverview] = useState<GradingAdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get<GradingAdminOverview>("/super-admin/grading/overview").then(({ data }) => setOverview(data)).catch(() => setError(strings.loadError));
  }, []);
  if (error) return <p className="error-text">{error}</p>;
  if (!overview) return <p>{strings.loading}</p>;

  const t = strings.register.table;

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="page-eyebrow">{strings.eyebrow}</span>
          <h1>{strings.title}</h1>
          <p className="page-subtitle">{strings.subtitle}</p>
        </div>
      </div>
      <div className="stat-tile-row">
        <div className="stat-tile">
          <p className="stat-label">{strings.stats.unclaimed}</p>
          <p className="stat-value">{overview.queue.pending}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">{strings.stats.claimed}</p>
          <p className="stat-value">{overview.queue.claimed}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">{strings.stats.completed}</p>
          <p className="stat-value">{overview.queue.completed}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">{strings.stats.aiDrafts}</p>
          <p className="stat-value">{overview.ai_usage.used}</p>
        </div>
      </div>
      <CollapsiblePanel
        className="workspace-panel"
        title={strings.register.title}
        description={strings.register.description}
        badge={<span className="badge badge-gray">{overview.reevaluations.length} {strings.register.recordsSuffix}</span>}
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t.student}</th>
                <th>{t.course}</th>
                <th>{t.reason}</th>
                <th>{t.status}</th>
                <th>{t.reviewer}</th>
                <th>{t.requested}</th>
                <th>{t.resolution}</th>
              </tr>
            </thead>
            <tbody>
              {overview.reevaluations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-cell">
                    {strings.register.empty}
                  </td>
                </tr>
              ) : (
                overview.reevaluations.map((request) => (
                  <tr key={request.id}>
                    <td>{request.student_name}</td>
                    <td>{request.module_title}</td>
                    <td className="grading-reason-cell">{request.reason}</td>
                    <td>
                      <span className={`badge ${STATUS_CLASS[request.status] ?? "badge-gray"}`}>{request.status.replace("_", " ")}</span>
                    </td>
                    <td>{request.assigned_to_name ?? "—"}</td>
                    <td>{new Date(request.created_at).toLocaleDateString()}</td>
                    <td>{request.resolution_note ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CollapsiblePanel>
    </div>
  );
}
