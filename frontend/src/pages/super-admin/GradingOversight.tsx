import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import type { GradingAdminOverview } from "@/api/types";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Badge, PageHeader } from "@/components/ui";
import { RouteLoadingState } from "@/components/RouteLoadingState";
import { gradingOversightStrings as strings } from "./GradingOversight.strings";
import { formatDate } from "@/utils/date";
import type { BadgeTone } from "@/components/ui";

const STATUS_CLASS: Record<string, BadgeTone> = { pending: "amber", in_review: "blue", resolved: "green", rejected: "red" };

export function GradingOversight() {
  const [overview, setOverview] = useState<GradingAdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get<GradingAdminOverview>("/super-admin/grading/overview").then(({ data }) => setOverview(data)).catch(() => setError(strings.loadError));
  }, []);
  if (error) return <p className="error-text">{error}</p>;
  if (!overview) return <RouteLoadingState />;

  const t = strings.register.table;

  return (
    <div>
      <PageHeader eyebrow={strings.eyebrow} title={strings.title} subtitle={strings.subtitle} />
      <div className="metric-grid">
        <MetricCard label={strings.stats.unclaimed} value={overview.queue.pending} tone="amber" icon="grading" />
        <MetricCard label={strings.stats.claimed} value={overview.queue.claimed} tone="blue" icon="session" />
        <MetricCard label={strings.stats.completed} value={overview.queue.completed} tone="green" icon="check" />
        <MetricCard label={strings.stats.aiDrafts} value={overview.ai_usage.used} tone="purple" icon="analytics" />
      </div>
      <CollapsiblePanel
        className="workspace-panel"
        title={strings.register.title}
        description={strings.register.description}
        badge={<Badge tone="gray">{overview.reevaluations.length} {strings.register.recordsSuffix}</Badge>}
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
                      <Badge tone={STATUS_CLASS[request.status] ?? "gray"}>{request.status.replace("_", " ")}</Badge>
                    </td>
                    <td>{request.assigned_to_name ?? "—"}</td>
                    <td>{formatDate(request.created_at)}</td>
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
