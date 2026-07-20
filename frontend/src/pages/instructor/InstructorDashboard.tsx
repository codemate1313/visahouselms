import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../api/client";
import { useAuthStore } from "../../store/authStore";

interface Summary {
  profile_completion: number;
  content: { modules: number; drafts: number; published: number; questions: number; audio: number; reading: number; speaking: number; writing: number; listening: number; full_mock: number; final_test: number };
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
      <div className="page-header"><div><span className="page-eyebrow">Instructor workspace</span><h1>Welcome, {user?.first_name}</h1><p className="page-subtitle">Create complete LanguageCert Academic assessment modules.</p></div><Link className="button-link" to="/super-admin/instructor/modules">+ Create Module</Link></div>
      <div className="stat-tile-row instructor-stats">
        <div className="stat-tile"><p className="stat-label">Modules</p><p className="stat-value">{summary.content.modules}</p></div>
        <div className="stat-tile"><p className="stat-label">Drafts</p><p className="stat-value">{summary.content.drafts}</p></div>
        <div className="stat-tile"><p className="stat-label">Published</p><p className="stat-value">{summary.content.published}</p></div>
        <div className="stat-tile"><p className="stat-label">Questions</p><p className="stat-value">{summary.content.questions}</p></div>
      </div>
      <div className="workspace-grid">
        <section className="workspace-panel">
          <div className="panel-heading"><div><h2>Module authoring</h2><p>Each module owns its questions, marking rules and media.</p></div><span className="badge badge-green">Structured authoring</span></div>
          <div className="authoring-actions">
            <div><strong>Skill modules</strong><p>{summary.content.reading + summary.content.listening + summary.content.writing + summary.content.speaking} Reading, Listening, Writing and Speaking modules.</p></div>
            <div><strong>Complete tests</strong><p>{summary.content.full_mock} full mocks and {summary.content.final_test} final tests.</p></div>
            <div><strong>Listening media</strong><p>{summary.content.audio} uploaded or text-to-speech MP3 files.</p></div>
          </div>
          <Link to="/super-admin/instructor/modules">Open module workspace →</Link>
        </section>
        <section className="workspace-panel">
          <div className="panel-heading"><div><h2>Profile readiness</h2><p>A complete profile helps content reviews and ownership.</p></div><strong>{summary.profile_completion}%</strong></div>
          <div className="progress-track"><span style={{ width: `${summary.profile_completion}%` }} /></div>
          {summary.profile_completion < 100 && <Link to="/super-admin/instructor/profile">Complete your profile →</Link>}
        </section>
        <section className="workspace-panel">
          <div className="panel-heading"><div><h2>Recent activity</h2><p>Your latest audited account and content actions.</p></div></div>
          {summary.recent_activity.length ? <ul className="activity-list">{summary.recent_activity.map((item, index) => <li key={`${item.action}-${index}`}><span>{actionLabel(item.action)}</span><time>{item.created_at ? new Date(item.created_at).toLocaleString() : "—"}</time></li>)}</ul> : <p className="empty-message">No activity yet.</p>}
        </section>
      </div>
    </div>
  );
}
