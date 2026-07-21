import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../api/client";
import type { AttemptSummary, StudentCurrentPlan } from "../../api/types";
import { useAuthStore } from "../../store/authStore";

const STATUS_LABEL: Record<string, string> = {
  ready: "Security check required",
  in_progress: "In progress",
  submitted: "Submitted",
  grading: "Awaiting grading",
  graded: "Graded",
  expired: "Expired",
};

export function StudentDashboard() {
  const user = useAuthStore((state) => state.user);
  const [attempts, setAttempts] = useState<AttemptSummary[] | null>(null);
  const [myPlan, setMyPlan] = useState<StudentCurrentPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiClient.get<AttemptSummary[]>("/student/attempts"),
      apiClient.get<StudentCurrentPlan>("/student/my-plan"),
    ])
      .then(([attemptsRes, coursesRes]) => {
        setAttempts(attemptsRes.data);
        setMyPlan(coursesRes.data);
      })
      .catch(() => setError("Failed to load your dashboard."));
  }, []);

  if (error) return <p className="error-text">{error}</p>;
  if (!attempts || !myPlan) return <p>Loading...</p>;

  const inProgress = attempts.filter((a) => a.status === "ready" || a.status === "in_progress").length;
  const graded = attempts.filter((a) => a.status === "graded").length;
  const pendingGrading = attempts.filter((a) => a.status === "grading").length;
  const isInstituteStudent = user?.institute_id != null;

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="page-eyebrow">{isInstituteStudent ? "Institute student portal" : "Direct student portal"}</span>
          <h1>Welcome, {user?.first_name}</h1>
          <p className="page-subtitle">{isInstituteStudent ? "Take the tests assigned to your institute and track your CEFR results." : "Manage your plan, take included tests, and track your CEFR results."}</p>
        </div>
        <Link className="button-link" to={isInstituteStudent ? "/student/my-courses" : "/student/courses"}>{isInstituteStudent ? "View assigned tests" : "View and upgrade plan"}</Link>
      </div>

      <div className="stat-tile-row">
        <div className="stat-tile"><p className="stat-label">Available tests</p><p className="stat-value">{myPlan.plan?.modules.length ?? 0}</p></div>
        <div className="stat-tile"><p className="stat-label">In progress</p><p className="stat-value">{inProgress}</p></div>
        <div className="stat-tile"><p className="stat-label">Awaiting grading</p><p className="stat-value">{pendingGrading}</p></div>
        <div className="stat-tile"><p className="stat-label">Graded</p><p className="stat-value">{graded}</p></div>
      </div>

      <div className="workspace-grid">
        <section className="workspace-panel">
          <div className="panel-heading"><div><h2>{isInstituteStudent ? "Institute assigned tests" : "Your learning plan"}</h2><p>{isInstituteStudent ? "Only tests allotted to your institute are available here." : "Tests included in your current plan."}</p></div></div>
          {myPlan.plan ? (
            <ul className="activity-list">
              <li><span>{isInstituteStudent ? "Available now" : myPlan.plan.name}</span><span>{myPlan.plan.modules.length} test{myPlan.plan.modules.length === 1 ? "" : "s"}</span></li>
            </ul>
          ) : (
            <p className="empty-message">{isInstituteStudent ? "No tests are currently assigned. Contact your institute administrator." : "No active plan. Choose a plan to begin."}</p>
          )}
          <Link to="/student/my-courses">Go to My Tests →</Link>
        </section>
        <section className="workspace-panel">
          <div className="panel-heading"><div><h2>Recent test activity</h2><p>Your most recent attempts across all courses.</p></div></div>
          {attempts.length ? (
            <ul className="activity-list">
              {attempts.slice(0, 6).map((attempt) => (
                <li key={attempt.id}>
                  <span>{attempt.module_title}</span>
                  <span>{STATUS_LABEL[attempt.status] ?? attempt.status}{attempt.band_label ? ` · ${attempt.band_label}` : ""}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-message">No test attempts yet.</p>
          )}
          <Link to="/student/attempts">View full history →</Link>
        </section>
      </div>
    </div>
  );
}
