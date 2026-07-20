import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../api/client";
import { useAuthStore } from "../../store/authStore";

interface Summary {
  profile_completion: number;
  content: { courses: number; question_banks: number; tests: number; drafts: number; assets: number };
  grading: { pending: number; in_progress: number; completed_today: number };
  recent_activity: { action: string; entity_type: string; entity_id: number | null; created_at: string | null }[];
}

function actionLabel(action: string): string {
  const value = action.split(".").pop() ?? action;
  return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

export function InstructorDashboard() {
  const user = useAuthStore((state) => state.user);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { apiClient.get<Summary>("/instructor/dashboard/summary").then(({ data }) => setSummary(data)).catch(() => setError("Failed to load your workspace.")); }, []);
  if (error) return <p className="error-text">{error}</p>;
  if (!summary) return <p>Loading...</p>;
  return (
    <div>
      <div className="page-header"><div><h1>Welcome, {user?.first_name}</h1><p className="page-subtitle">Your central content-authoring workspace.</p></div><Link className="button-link" to="/instructor/question-banks/new">+ New Question Bank</Link></div>
      <div className="stat-tile-row instructor-stats">
        <div className="stat-tile"><p className="stat-label">Courses</p><p className="stat-value">{summary.content.courses}</p></div>
        <div className="stat-tile"><p className="stat-label">Draft courses</p><p className="stat-value">{summary.content.drafts}</p></div>
        <div className="stat-tile"><p className="stat-label">Tests</p><p className="stat-value">{summary.content.tests}</p></div>
        <div className="stat-tile"><p className="stat-label">Pending grading</p><p className="stat-value">{summary.grading.pending}</p></div>
      </div>
      <div className="workspace-grid">
        <section className="workspace-panel">
          <div className="panel-heading"><div><h2>Authoring</h2><p>Build reusable IELTS learning content.</p></div><span className="badge badge-green">Phase 3.3 live</span></div>
          <div className="authoring-actions">
            <div><strong>Courses</strong><p>{summary.content.assets} PDF/MP3 resources across {summary.content.courses} owned courses.</p></div>
            <div><strong>Question banks</strong><p>Create reusable questions for every IELTS section.</p></div>
            <div><strong>Tests</strong><p>Assemble practice, mock, and final assessments.</p></div>
          </div>
          <Link to="/instructor/workspace">Open content workspace →</Link>
        </section>
        <section className="workspace-panel">
          <div className="panel-heading"><div><h2>Profile readiness</h2><p>A complete profile helps content reviews and ownership.</p></div><strong>{summary.profile_completion}%</strong></div>
          <div className="progress-track"><span style={{ width: `${summary.profile_completion}%` }} /></div>
          {summary.profile_completion < 100 && <Link to="/instructor/profile">Complete your profile →</Link>}
        </section>
        <section className="workspace-panel">
          <div className="panel-heading"><div><h2>Recent activity</h2><p>Your latest audited account and content actions.</p></div></div>
          {summary.recent_activity.length ? <ul className="activity-list">{summary.recent_activity.map((item, index) => <li key={`${item.action}-${index}`}><span>{actionLabel(item.action)}</span><time>{item.created_at ? new Date(item.created_at).toLocaleString() : "—"}</time></li>)}</ul> : <p className="empty-message">No activity yet.</p>}
        </section>
      </div>
    </div>
  );
}
