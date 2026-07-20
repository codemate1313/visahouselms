import { useEffect, useState } from "react";
import { apiClient } from "../../api/client";

interface Grading { pending: number; in_progress: number; completed_today: number }
export function GradingQueue() {
  const [grading, setGrading] = useState<Grading | null>(null);
  useEffect(() => { apiClient.get("/instructor/dashboard/summary").then(({ data }) => setGrading(data.grading)); }, []);
  return <div><div className="page-header"><div><h1>Grading Queue</h1><p className="page-subtitle">Writing and speaking submissions will appear here when assessment delivery is enabled.</p></div></div><div className="stat-tile-row"><div className="stat-tile"><p className="stat-label">Pending</p><p className="stat-value">{grading?.pending ?? 0}</p></div><div className="stat-tile"><p className="stat-label">In progress</p><p className="stat-value">{grading?.in_progress ?? 0}</p></div><div className="stat-tile"><p className="stat-label">Completed today</p><p className="stat-value">{grading?.completed_today ?? 0}</p></div></div><div className="empty-state"><h2>No submissions waiting</h2><p>The queue is connected to the instructor dashboard and ready for Phase 3.3 assessment records.</p></div></div>;
}
