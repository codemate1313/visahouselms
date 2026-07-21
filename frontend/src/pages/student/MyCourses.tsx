import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import type { StudentCurrentPlan } from "../../api/types";
import { useToastStore } from "../../store/toastStore";
import { useAuthStore } from "../../store/authStore";

const MODULE_TYPE_LABEL: Record<string, string> = {
  reading: "Reading",
  speaking: "Speaking",
  writing: "Writing",
  listening: "Listening",
  full_mock: "Full Mock Test",
  final_test: "Final Test",
};

const IMMERSIVE_MODULE_TYPES = new Set(["full_mock"]);

export function MyCourses() {
  const navigate = useNavigate();
  const showError = useToastStore((state) => state.showError);
  const isInstituteStudent = useAuthStore((state) => state.user?.institute_id != null);
  const [access, setAccess] = useState<StudentCurrentPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<number | null>(null);

  useEffect(() => {
    apiClient
      .get<StudentCurrentPlan>("/student/my-plan")
      .then(({ data }) => setAccess(data))
      .catch(() => setError("Failed to load your learning plan."))
      .finally(() => setLoading(false));
  }, []);

  async function startModule(moduleId: number, moduleType: string) {
    setStarting(moduleId);
    let enteredFullscreen = false;
    try {
      if (
        IMMERSIVE_MODULE_TYPES.has(moduleType) &&
        !document.fullscreenElement &&
        document.documentElement.requestFullscreen
      ) {
        try {
          await document.documentElement.requestFullscreen();
          enteredFullscreen = Boolean(document.fullscreenElement);
        } catch {
          // The runner presents a user-gesture retry screen when the browser blocks this request.
        }
      }
      const { data } = await apiClient.post<{ id: number }>(`/student/modules/${moduleId}/attempts`);
      navigate(`/student/attempts/${data.id}/take`);
    } catch (err: unknown) {
      if (enteredFullscreen && document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
      showError(extractErrorMessage(err, "Failed to start the test."), "Could Not Start");
    } finally {
      setStarting(null);
    }
  }

  if (error) return <p className="error-text">{error}</p>;

  return (
    <div>
      <div className="page-header">
        <div><span className="page-eyebrow">Learning</span><h1>{isInstituteStudent ? "Assigned Tests" : "My Tests"}</h1><p className="page-subtitle">{isInstituteStudent ? "Start a test allotted to your institute." : "Start a test included in your active plan."}</p></div>
      </div>
      {loading ? (
        <p>Loading...</p>
      ) : !access?.plan ? (
        <div className="empty-state"><h2>{isInstituteStudent ? "No tests assigned" : "No active learning plan"}</h2><p>{isInstituteStudent ? "Contact your institute administrator to confirm course access." : "Choose or upgrade a plan to unlock tests."}</p></div>
      ) : (
        <section className="workspace-panel" style={{ marginBottom: 16 }}>
          <div className="panel-heading">
            <div><h2>{access.plan.name}</h2><p>{access.plan.description || "Your assigned assessment access."}</p></div>
            {!isInstituteStudent && access.expires_at && <span className="badge badge-gray">Access until {new Date(access.expires_at).toLocaleDateString()}</span>}
          </div>
          {access.plan.modules.length ? (
            <div className="module-list-grid">
              {access.plan.modules.map((module) => {
                const moduleId = module.module_id ?? module.id;
                if (!moduleId) return null;
                return (
                  <div className="module-record-card" key={moduleId}>
                    <div className="section-chip">{MODULE_TYPE_LABEL[module.module_type] ?? module.module_type}</div>
                    <h2>{module.title}</h2>
                    <p>{module.duration_minutes} minutes</p>
                    <button disabled={starting === moduleId} onClick={() => startModule(moduleId, module.module_type)}>
                      {starting === moduleId ? "Starting..." : "Start test"}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="empty-message">{isInstituteStudent ? "No published tests are assigned to your institute yet." : "No published tests are attached to this plan yet."}</p>
          )}
        </section>
      )}
    </div>
  );
}
