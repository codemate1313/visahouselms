import { useEffect, useMemo, useState } from "react";
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

function ModuleTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "reading":
      return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4.5A2.5 2.5 0 0 1 4.5 2H9a2 2 0 0 1 2 2v16.5A1.5 1.5 0 0 0 9.5 19H2z" /><path d="M22 4.5A2.5 2.5 0 0 0 19.5 2H15a2 2 0 0 0-2 2v16.5a1.5 1.5 0 0 1 1.5-1.5H22z" /></svg>;
    case "speaking":
      return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" /></svg>;
    case "writing":
      return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
    case "listening":
      return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 14v-3a9 9 0 0 1 18 0v3" /><path d="M21 15.5a2.5 2.5 0 0 1-2.5 2.5H17v-6h1.5a2.5 2.5 0 0 1 2.5 2.5ZM3 15.5A2.5 2.5 0 0 0 5.5 18H7v-6H5.5A2.5 2.5 0 0 0 3 14.5Z" /></svg>;
    case "final_test":
      return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22V4a1 1 0 0 1 1-1h13.5a.5.5 0 0 1 .5.5V16a.5.5 0 0 1-.5.5H6a2 2 0 0 0-2 2Zm0 0a2 2 0 0 0 2 2h12" /></svg>;
    default:
      return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>;
  }
}

function ClockIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
}

function ArrowIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>;
}

function SearchIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
}

function SpinnerIcon() {
  return (
    <svg className="start-test-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function MyCourses() {
  const navigate = useNavigate();
  const showError = useToastStore((state) => state.showError);
  const isInstituteStudent = useAuthStore((state) => state.user?.institute_id != null);
  const [access, setAccess] = useState<StudentCurrentPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    apiClient
      .get<StudentCurrentPlan>("/student/my-plan")
      .then(({ data }) => setAccess(data))
      .catch(() => setError("Failed to load your learning plan."))
      .finally(() => setLoading(false));
  }, []);

  const allModules = access?.plan?.modules ?? [];

  const availableTypes = useMemo(
    () => Array.from(new Set(allModules.map((m) => m.module_type))),
    [allModules],
  );

  const visibleModules = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allModules.filter((m) => {
      if (typeFilter !== "ALL" && m.module_type !== typeFilter) return false;
      if (q && !m.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allModules, typeFilter, search]);

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
    <div className="my-courses-page">
      <div className="page-header">
        <div><span className="page-eyebrow">Learning</span><h1>{isInstituteStudent ? "Assigned Tests" : "My Tests"}</h1><p className="page-subtitle">{isInstituteStudent ? "Start a test allotted to your institute." : "Start a test included in your active plan."}</p></div>
      </div>

      {!loading && access?.plan && allModules.length > 0 && (
        <div className="assigned-tests-filter-bar">
          <div className="assigned-tests-filter-pills">
            <button
              type="button"
              className={`filter-pill ${typeFilter === "ALL" ? "selected" : ""}`}
              onClick={() => setTypeFilter("ALL")}
            >
              All
            </button>
            {availableTypes.map((type) => (
              <button
                key={type}
                type="button"
                className={`filter-pill ${typeFilter === type ? "selected" : ""}`}
                onClick={() => setTypeFilter(type)}
              >
                {MODULE_TYPE_LABEL[type] ?? type}
              </button>
            ))}
          </div>
          <div className="assigned-tests-search">
            <SearchIcon />
            <input
              type="text"
              className="assigned-tests-search-input"
              placeholder="Search tests..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="assigned-tests-skeleton">
          {Array.from({ length: 6 }).map((_, i) => <div className="skeleton-test-card" key={i} />)}
        </div>
      ) : !access?.plan ? (
        <div className="empty-state assigned-tests-empty">
          <div className="empty-state-icon"><ModuleTypeIcon type="" /></div>
          <h2>{isInstituteStudent ? "No tests assigned" : "No active learning plan"}</h2>
          <p>{isInstituteStudent ? "Contact your institute administrator to confirm course access." : "Choose or upgrade a plan to unlock tests."}</p>
        </div>
      ) : (
        <section className="workspace-panel assigned-tests-panel" style={{ marginBottom: 16 }}>
          <div className="panel-heading">
            <div>
              <h2>{access.plan.name}</h2>
              <p>{access.plan.description || "Your assigned assessment access."}</p>
            </div>
            <div className="assigned-tests-meta">
              {!isInstituteStudent && access.expires_at && <span className="badge badge-gray">Access until {new Date(access.expires_at).toLocaleDateString()}</span>}
              <span className="assigned-count-pill">{visibleModules.length} test{visibleModules.length === 1 ? "" : "s"}</span>
            </div>
          </div>
          {!allModules.length ? (
            <p className="empty-message">{isInstituteStudent ? "No published tests are assigned to your institute yet." : "No published tests are attached to this plan yet."}</p>
          ) : !visibleModules.length ? (
            <p className="empty-message">No tests match your filters. Try clearing the search or selecting a different category.</p>
          ) : (
            <div className="assigned-tests-grid">
              {visibleModules.map((module) => {
                const moduleId = module.module_id ?? module.id;
                if (!moduleId) return null;
                const isStarting = starting === moduleId;
                return (
                  <div className="assigned-test-card" key={moduleId}>
                    <div className="assigned-test-top">
                      <div className="assigned-test-icon"><ModuleTypeIcon type={module.module_type} /></div>
                      <span className="assigned-test-chip">{MODULE_TYPE_LABEL[module.module_type] ?? module.module_type}</span>
                    </div>
                    <h2>{module.title}</h2>
                    <p className="assigned-test-duration"><ClockIcon /> {module.duration_minutes} minutes</p>
                    <button
                      className="start-test-btn"
                      disabled={isStarting}
                      onClick={() => startModule(moduleId, module.module_type)}
                    >
                      {isStarting ? (
                        <><SpinnerIcon /> Starting...</>
                      ) : (
                        <>Start test <ArrowIcon /></>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
