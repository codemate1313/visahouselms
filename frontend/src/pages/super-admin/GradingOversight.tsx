import { useEffect, useState } from "react";
import { apiClient } from "../../api/client";
import type { GradingAdminOverview } from "../../api/types";

const STATUS_CLASS: Record<string, string> = { pending: "badge-amber", in_review: "badge-blue", resolved: "badge-green", rejected: "badge-red" };

export function GradingOversight() {
  const [overview, setOverview] = useState<GradingAdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { apiClient.get<GradingAdminOverview>("/super-admin/grading/overview").then(({ data }) => setOverview(data)).catch(() => setError("Failed to load grading operations.")); }, []);
  if (error) return <p className="error-text">{error}</p>;
  if (!overview) return <p>Loading...</p>;

  return <div>
    <div className="page-header"><div><span className="page-eyebrow">Phase 6 operations</span><h1>Grading Oversight</h1><p className="page-subtitle">Monitor queue ownership, reevaluation workload, and assisted-evaluation usage.</p></div></div>
    <div className="stat-tile-row"><div className="stat-tile"><p className="stat-label">Unclaimed</p><p className="stat-value">{overview.queue.pending}</p></div><div className="stat-tile"><p className="stat-label">Claimed</p><p className="stat-value">{overview.queue.claimed}</p></div><div className="stat-tile"><p className="stat-label">Completed</p><p className="stat-value">{overview.queue.completed}</p></div><div className="stat-tile"><p className="stat-label">AI drafts this month</p><p className="stat-value">{overview.ai_usage.used}</p></div></div>
    <section className="workspace-panel"><div className="panel-heading"><div><h2>Reevaluation register</h2><p>Latest student review requests across direct and institute accounts.</p></div><span className="badge badge-gray">{overview.reevaluations.length} records</span></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Student</th><th>Course</th><th>Reason</th><th>Status</th><th>Reviewer</th><th>Requested</th><th>Resolution</th></tr></thead><tbody>{overview.reevaluations.length === 0 ? <tr><td colSpan={7} className="empty-cell">No reevaluation requests.</td></tr> : overview.reevaluations.map((request) => <tr key={request.id}><td>{request.student_name}</td><td>{request.module_title}</td><td className="grading-reason-cell">{request.reason}</td><td><span className={`badge ${STATUS_CLASS[request.status] ?? "badge-gray"}`}>{request.status.replace("_", " ")}</span></td><td>{request.assigned_to_name ?? "—"}</td><td>{new Date(request.created_at).toLocaleDateString()}</td><td>{request.resolution_note ?? "—"}</td></tr>)}</tbody></table></div></section>
  </div>;
}
