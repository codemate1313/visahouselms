import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../api/client";
import type { GradingQueueItem } from "../../api/types";

const STATUS_CLASS: Record<string, string> = { grading: "badge-amber", graded: "badge-green" };

export function GradingQueue() {
  const [items, setItems] = useState<GradingQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    apiClient
      .get<GradingQueueItem[]>("/instructor/grading", { params: { status: statusFilter || undefined } })
      .then(({ data }) => setItems(data))
      .catch(() => setError("Failed to load the grading queue."))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const pending = items.filter((item) => item.status === "grading").length;
  const graded = items.filter((item) => item.status === "graded").length;

  return (
    <div>
      <div className="page-header">
        <div><h1>Grading Queue</h1><p className="page-subtitle">Writing and Speaking submissions from your published modules.</p></div>
      </div>
      <div className="stat-tile-row">
        <div className="stat-tile"><p className="stat-label">Awaiting grading</p><p className="stat-value">{pending}</p></div>
        <div className="stat-tile"><p className="stat-label">Graded</p><p className="stat-value">{graded}</p></div>
      </div>
      <form className="filter-bar" onSubmit={(e) => e.preventDefault()}>
        <select aria-label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All</option>
          <option value="grading">Awaiting grading</option>
          <option value="graded">Graded</option>
        </select>
      </form>
      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : items.length === 0 ? (
        <div className="empty-state"><h2>No submissions waiting</h2><p>Submissions for your Writing and Speaking modules will appear here once students submit.</p></div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Student</th><th>Module</th><th>Status</th><th>Submitted</th><th>Flags</th><th>Parts left</th><th></th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="clickable">
                  <td>{item.student_name}</td>
                  <td>{item.module_title}</td>
                  <td><span className={`badge ${STATUS_CLASS[item.status] ?? "badge-gray"}`}>{item.status}</span></td>
                  <td>{item.submitted_at ? new Date(item.submitted_at).toLocaleString() : "—"}</td>
                  <td>{item.flag_count > 0 ? <span className="badge badge-red">{item.flag_count}</span> : "—"}</td>
                  <td>{item.parts_to_grade}</td>
                  <td className="table-actions"><Link to={`/super-admin/instructor/grading/${item.id}`}>Grade →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
