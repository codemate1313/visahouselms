import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import type { StudentCurrentPlan } from "@/api/types";
import { PageHeader } from "@/components/ui";
import { useToastStore } from "@/store/toastStore";
import { useAuthStore } from "@/store/authStore";
import { myCoursesStrings as strings } from "./MyCourses.strings";
import { ModuleTypeIcon } from "./icons";
import { ModuleFilterBar } from "./components/ModuleFilterBar";
import { AssignedTestsGrid } from "./components/AssignedTestsGrid";

const IMMERSIVE_MODULE_TYPES = new Set(["full_mock"]);

export function MyCourses() {
  const containerRef = useRef<HTMLDivElement>(null);
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
      .catch(() => setError(strings.loadError))
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      showError(extractErrorMessage(err, strings.errors.startModule), strings.errors.startModuleTitle);
    } finally {
      setStarting(null);
    }
  }

  useEffect(() => {
    if (!loading && visibleModules.length > 0) {
      const ctx = gsap.context(() => {
        gsap.fromTo(
          ".assigned-test-card",
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6, stagger: 0.05, ease: "power3.out" }
        );
      }, containerRef);
      return () => ctx.revert();
    }
  }, [visibleModules, loading]);

  if (error) return <p className="error-text">{error}</p>;

  return (
    <div className="my-courses-page" ref={containerRef}>
      <PageHeader
        eyebrow={strings.eyebrow}
        title={isInstituteStudent ? strings.titles.instituteStudent : strings.titles.directStudent}
        subtitle={isInstituteStudent ? strings.subtitles.instituteStudent : strings.subtitles.directStudent}
      />

      {!loading && access?.plan && allModules.length > 0 && (
        <ModuleFilterBar
          availableTypes={availableTypes}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          search={search}
          onSearchChange={setSearch}
        />
      )}

      {loading ? (
        <div className="assigned-tests-skeleton">
          {Array.from({ length: 6 }).map((_, i) => <div className="skeleton-test-card" key={i} />)}
        </div>
      ) : !access?.plan ? (
        <div className="empty-state assigned-tests-empty">
          <div className="empty-state-icon">
            <ModuleTypeIcon type="" />
          </div>
          <h2>{isInstituteStudent ? strings.empty.instituteTitle : strings.empty.directTitle}</h2>
          <p>{isInstituteStudent ? strings.empty.instituteDescription : strings.empty.directDescription}</p>
        </div>
      ) : (
        <section className="workspace-panel assigned-tests-panel" style={{ marginBottom: 16 }}>
          <div className="panel-heading">
            <div>
              <h2>{access.plan.name}</h2>
              <p>{access.plan.description || strings.defaultPlanDescription}</p>
            </div>
            <div className="assigned-tests-meta">
              {!isInstituteStudent && access.expires_at && (
                <span className="badge badge-gray">{strings.accessUntil(new Date(access.expires_at).toLocaleDateString())}</span>
              )}
              <span className="assigned-count-pill">{strings.testsCount(visibleModules.length)}</span>
            </div>
          </div>
          {!allModules.length ? (
            <p className="empty-message">{isInstituteStudent ? strings.empty.noModulesInstitute : strings.empty.noModulesDirect}</p>
          ) : !visibleModules.length ? (
            <p className="empty-message">{strings.empty.noFilterMatches}</p>
          ) : (
            <AssignedTestsGrid modules={visibleModules} starting={starting} onStartModule={startModule} />
          )}
        </section>
      )}
    </div>
  );
}
