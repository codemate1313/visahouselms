import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../api/client";
import type { GradingQueueItem } from "../../api/types";
import { SearchableSelect } from "../../components/SearchableSelect";
import { useAuthStore } from "../../store/authStore";

const STATUS_CLASS: Record<string, string> = { pending: "badge-amber", claimed: "badge-blue", completed: "badge-green" };

export function GradingQueue() {
  const isInstituteInstructor = useAuthStore((state) => state.user?.role === "INST_INSTRUCTOR");
  const gradingBase = isInstituteInstructor ? "/institute-instructor/grading" : "/super-admin/instructor/grading";
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

  const pending = items.filter((item) => item.queue.status === "pending").length;
  const claimed = items.filter((item) => item.queue.status === "claimed").length;
  const reevaluations = items.filter((item) => item.is_reevaluation).length;

  return (
    <div>
      <div className="page-header">
        <div><h1>Grading Queue</h1><p className="page-subtitle">{isInstituteInstructor ? "Writing and Speaking submissions from students in your institute." : "Direct-student submissions and institute submissions without an active institute instructor."}</p></div>
      </div>
      <div className="stat-tile-row">
        <div className="stat-tile"><p className="stat-label">Awaiting grading</p><p className="stat-value">{pending}</p></div>
        <div className="stat-tile"><p className="stat-label">Claimed</p><p className="stat-value">{claimed}</p></div>
        <div className="stat-tile"><p className="stat-label">Reevaluations</p><p className="stat-value">{reevaluations}</p></div>
      </div>
      <form className="filter-bar" onSubmit={(e) => e.preventDefault()}>
        <SearchableSelect
          ariaLabel="Status"
          options={[
            { value: "", label: "All" },
            { value: "pending", label: "Unclaimed" },
            { value: "claimed", label: "Claimed" },
            { value: "completed", label: "Completed" },
          ]}
          value={statusFilter}
          onChange={(value) => setStatusFilter(String(value))}
          searchable={false}
          className="status-filter-select"
        />
      </form>
      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : items.length === 0 ? (
        <div className="empty-state"><h2>No submissions waiting</h2><p>Submissions for your Writing and Speaking modules will appear here once students submit.</p></div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Student</th><th>Course</th><th>Queue</th><th>Owner</th><th>Due</th><th>Flags</th><th>Parts left</th><th></th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="clickable">
                  <td>{item.student_name}</td>
                  <td>{item.module_title}{item.is_reevaluation && <span className="badge badge-red">Reevaluation</span>}</td>
                  <td><span className={`badge ${STATUS_CLASS[item.queue.status] ?? "badge-gray"}`}>{item.queue.status}</span></td>
                  <td>{item.queue.assigned_to_name ?? "Unclaimed"}</td>
                  <td>{item.queue.due_at ? new Date(item.queue.due_at).toLocaleDateString() : "—"}</td>
                  <td>{item.flag_count > 0 ? <span className="badge badge-red">{item.flag_count}</span> : "—"}</td>
                  <td>{item.parts_to_grade}</td>
                  <td className="table-actions"><Link to={`${gradingBase}/${item.id}`}>Grade →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
