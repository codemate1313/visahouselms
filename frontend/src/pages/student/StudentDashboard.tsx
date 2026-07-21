import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../api/client";
import type { AttemptSummary, CatalogCourse } from "../../api/types";
import { useAuthStore } from "../../store/authStore";

const STATUS_LABEL: Record<string, string> = {
  in_progress: "In progress",
  submitted: "Submitted",
  grading: "Awaiting grading",
  graded: "Graded",
  expired: "Expired",
};

export function StudentDashboard() {
  const user = useAuthStore((state) => state.user);
  const [attempts, setAttempts] = useState<AttemptSummary[] | null>(null);
  const [myCourses, setMyCourses] = useState<CatalogCourse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiClient.get<AttemptSummary[]>("/student/attempts"),
      apiClient.get<CatalogCourse[]>("/student/my-courses"),
    ])
      .then(([attemptsRes, coursesRes]) => {
        setAttempts(attemptsRes.data);
        setMyCourses(coursesRes.data);
      })
      .catch(() => setError("Failed to load your dashboard."));
  }, []);

  if (error) return <p className="error-text">{error}</p>;
  if (!attempts || !myCourses) return <p>Loading...</p>;

  const inProgress = attempts.filter((a) => a.status === "in_progress").length;
  const graded = attempts.filter((a) => a.status === "graded").length;
  const pendingGrading = attempts.filter((a) => a.status === "grading").length;

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="page-eyebrow">Student portal</span>
          <h1>Welcome, {user?.first_name}</h1>
          <p className="page-subtitle">Track your enrolled courses, in-progress tests, and results.</p>
        </div>
        <Link className="button-link" to="/student/courses">Browse courses</Link>
      </div>

      <div className="stat-tile-row">
        <div className="stat-tile"><p className="stat-label">Enrolled courses</p><p className="stat-value">{myCourses.length}</p></div>
        <div className="stat-tile"><p className="stat-label">In progress</p><p className="stat-value">{inProgress}</p></div>
        <div className="stat-tile"><p className="stat-label">Awaiting grading</p><p className="stat-value">{pendingGrading}</p></div>
        <div className="stat-tile"><p className="stat-label">Graded</p><p className="stat-value">{graded}</p></div>
      </div>

      <div className="workspace-grid">
        <section className="workspace-panel">
          <div className="panel-heading"><div><h2>Your courses</h2><p>Modules you're entitled to take.</p></div></div>
          {myCourses.length ? (
            <ul className="activity-list">
              {myCourses.slice(0, 5).map((course) => (
                <li key={course.id}><span>{course.title}</span><span>{course.module_count} module{course.module_count === 1 ? "" : "s"}</span></li>
              ))}
            </ul>
          ) : (
            <p className="empty-message">No courses yet — browse the catalog to get started.</p>
          )}
          <Link to="/student/my-courses">Go to My Courses →</Link>
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
