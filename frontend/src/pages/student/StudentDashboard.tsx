import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
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

const COMPLETED_STATUSES = new Set(["submitted", "grading", "graded"]);

function statusTone(status: string) {
  if (status === "graded") return "success";
  if (status === "grading" || status === "submitted") return "warning";
  if (status === "ready" || status === "in_progress") return "info";
  return "muted";
}

function attemptTime(attempt: AttemptSummary) {
  return new Date(attempt.submitted_at ?? attempt.started_at).getTime();
}

function formatAttemptDate(attempt: AttemptSummary) {
  const value = attempt.submitted_at ?? attempt.started_at;
  if (!value) return "Not started";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function progressForStatus(status?: string) {
  if (!status) return 0;
  if (status === "ready") return 15;
  if (status === "in_progress") return 45;
  if (status === "submitted" || status === "grading") return 80;
  if (status === "graded") return 100;
  if (status === "expired") return 100;
  return 0;
}

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
  const assignedModules = myPlan.plan?.modules ?? [];
  const latestAttemptByModule = new Map<number, AttemptSummary>();
  attempts.forEach((attempt) => {
    const current = latestAttemptByModule.get(attempt.module_id);
    if (!current || attemptTime(attempt) > attemptTime(current)) {
      latestAttemptByModule.set(attempt.module_id, attempt);
    }
  });
  const testProgress = assignedModules.map((module) => {
    const moduleId = module.module_id ?? module.id ?? 0;
    const latestAttempt = latestAttemptByModule.get(moduleId);
    const progress = progressForStatus(latestAttempt?.status);
    return {
      module,
      moduleId,
      latestAttempt,
      progress,
      statusLabel: latestAttempt ? STATUS_LABEL[latestAttempt.status] ?? latestAttempt.status : "Not started",
    };
  });
  const completedTests = testProgress.filter((item) => item.latestAttempt && COMPLETED_STATUSES.has(item.latestAttempt.status)).length;
  const pendingTests = Math.max(assignedModules.length - completedTests, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="page-eyebrow">{isInstituteStudent ? "Institute student portal" : "Direct student portal"}</span>
          <h1>Welcome, {user?.first_name}</h1>
          <p className="page-subtitle">{isInstituteStudent ? "Take the tests assigned to your institute and track your CEFR results." : "Manage your plan, take included tests, and track your CEFR results."}</p>
        </div>
      </div>

      <div className="stat-tile-row">
        <div className="stat-tile"><p className="stat-label">Available tests</p><p className="stat-value">{myPlan.plan?.modules.length ?? 0}</p></div>
        <div className="stat-tile"><p className="stat-label">Completed</p><p className="stat-value">{completedTests}</p></div>
        <div className="stat-tile"><p className="stat-label">Pending</p><p className="stat-value">{pendingTests}</p></div>
        <div className="stat-tile"><p className="stat-label">In progress</p><p className="stat-value">{inProgress}</p></div>
        <div className="stat-tile"><p className="stat-label">Awaiting grading</p><p className="stat-value">{pendingGrading}</p></div>
        <div className="stat-tile"><p className="stat-label">Graded</p><p className="stat-value">{graded}</p></div>
      </div>

      <div className="workspace-grid">
        <section className="workspace-panel">
          <div className="panel-heading"><div><h2>{isInstituteStudent ? "Institute assigned tests" : "Your learning plan"}</h2><p>{isInstituteStudent ? "Only tests allotted to your institute are available here." : "Tests included in your current plan."}</p></div></div>
          {myPlan.plan && testProgress.length ? (
            <div className="student-test-progress-list">
              <div className="student-test-progress-summary">
                <span>{completedTests} completed</span>
                <span>{pendingTests} pending</span>
              </div>
              {testProgress.map((item, index) => (
                <article className="student-test-progress-card" key={item.moduleId || item.module.title}>
                  <div className="student-test-progress-head">
                    <div>
                      <span className="student-test-type">{item.module.module_type.replaceAll("_", " ")}</span>
                      <h3>{item.module.title}</h3>
                    </div>
                    <strong>{item.progress}%</strong>
                  </div>
                  <div className="student-test-progress-meta">
                    <span>{item.statusLabel}</span>
                    <span>{item.module.duration_minutes} min</span>
                  </div>
                  <div className="student-test-progress-track" aria-label={`${item.module.title} progress ${item.progress}%`}>
                    <span
                      style={{
                        "--progress-value": `${item.progress}%`,
                        "--progress-delay": `${index * 90}ms`,
                      } as CSSProperties}
                    />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-message">{isInstituteStudent ? "No tests are currently assigned. Contact your institute administrator." : "No active plan. Choose a plan to begin."}</p>
          )}
          <Link to="/student/my-courses">Go to My Tests →</Link>
        </section>
        <section className="workspace-panel">
          <div className="panel-heading"><div><h2>Recent test activity</h2><p>Your most recent attempts across all courses.</p></div></div>
          {attempts.length ? (
            <ul className="activity-list recent-test-activity-list">
              {attempts.slice(0, 6).map((attempt) => (
                <li key={attempt.id}>
                  <div className="recent-test-activity-main">
                    <span className="student-test-type">{attempt.module_type.replaceAll("_", " ")}</span>
                    <strong>{attempt.module_title}</strong>
                    <small>{formatAttemptDate(attempt)}{attempt.band_label ? ` · ${attempt.band_label}` : ""}</small>
                  </div>
                  <div className="recent-test-activity-side">
                    <span className={`recent-status-badge is-${statusTone(attempt.status)}`}>
                      {STATUS_LABEL[attempt.status] ?? attempt.status}
                    </span>
                    {attempt.raw_score && attempt.max_score && (
                      <small>{Number(attempt.raw_score).toFixed(0)} / {Number(attempt.max_score).toFixed(0)}</small>
                    )}
                  </div>
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
