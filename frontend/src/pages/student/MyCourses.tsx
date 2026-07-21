import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import type { CatalogCourse } from "../../api/types";
import { useToastStore } from "../../store/toastStore";

const MODULE_TYPE_LABEL: Record<string, string> = {
  reading: "Reading",
  speaking: "Speaking",
  writing: "Writing",
  listening: "Listening",
  full_mock: "Full Mock Test",
  final_test: "Final Test",
};

export function MyCourses() {
  const navigate = useNavigate();
  const showError = useToastStore((state) => state.showError);
  const [courses, setCourses] = useState<CatalogCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<number | null>(null);

  useEffect(() => {
    apiClient
      .get<CatalogCourse[]>("/student/my-courses")
      .then(({ data }) => setCourses(data))
      .catch(() => setError("Failed to load your courses."))
      .finally(() => setLoading(false));
  }, []);

  async function startModule(moduleId: number) {
    setStarting(moduleId);
    try {
      const { data } = await apiClient.post<{ id: number }>(`/student/modules/${moduleId}/attempts`);
      navigate(`/student/attempts/${data.id}/take`);
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Failed to start the test."), "Could Not Start");
    } finally {
      setStarting(null);
    }
  }

  if (error) return <p className="error-text">{error}</p>;

  return (
    <div>
      <div className="page-header">
        <div><span className="page-eyebrow">Learning</span><h1>My Courses</h1><p className="page-subtitle">Start or resume a test from any course you have access to.</p></div>
      </div>
      {loading ? (
        <p>Loading...</p>
      ) : courses.length === 0 ? (
        <div className="empty-state"><h2>No courses yet</h2><p>Browse the catalog and purchase a course to get started.</p></div>
      ) : (
        courses.map((course) => (
          <section className="workspace-panel" key={course.id} style={{ marginBottom: 16 }}>
            <div className="panel-heading"><div><h2>{course.title}</h2><p>{course.summary || "No summary added yet."}</p></div></div>
            {course.modules?.length ? (
              <div className="module-list-grid">
                {course.modules.map((module) => (
                  <div className="module-record-card" key={module.module_id}>
                    <div className="section-chip">{MODULE_TYPE_LABEL[module.module_type] ?? module.module_type}</div>
                    <h2>{module.title}</h2>
                    <p>{module.duration_minutes} minutes</p>
                    <button disabled={starting === module.module_id} onClick={() => startModule(module.module_id)}>
                      {starting === module.module_id ? "Starting..." : "Start test"}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-message">No modules attached to this course yet.</p>
            )}
          </section>
        ))
      )}
    </div>
  );
}
