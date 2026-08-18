import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import type { StudentCurrentPlan } from "@/api/types";
import { Button, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";
import { useToastStore } from "@/store/toastStore";
import { useAuthStore } from "@/store/authStore";
import { myCoursesStrings as strings } from "./MyCourses.strings";
import { ModuleTypeIcon } from "./icons";
import { ModuleFilterBar } from "./components/ModuleFilterBar";
import { AssignedTestsGrid } from "./components/AssignedTestsGrid";
import { releaseSpeakingMicrophone } from "@/media/speakingMicrophone";
import { formatDate } from "@/utils/date";

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

  const allModules = useMemo(() => access?.plan?.modules ?? [], [access?.plan?.modules]);

  const availableTypes = useMemo(
    () => Array.from(new Set(allModules.map((m) => m.module_type))),
    [allModules],
  );

  const visibleModules = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = allModules.filter((m) => {
      if (typeFilter !== "ALL" && m.module_type !== typeFilter) return false;
      if (q && !m.title.toLowerCase().includes(q)) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      const aLocked = Boolean(a.is_locked);
      const bLocked = Boolean(b.is_locked);
      if (aLocked !== bLocked) {
        return aLocked ? 1 : -1;
      }
      return 0;
    });
  }, [allModules, typeFilter, search]);

  async function startModule(moduleId: number, moduleType: string, isLocked?: boolean) {
    if (isLocked) {
      showError(
        "This test module is not included in your active subscription plan. Please upgrade your plan to unlock.",
        "Course Locked"
      );
      navigate("/student/courses");
      return;
    }


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
      releaseSpeakingMicrophone();
    } finally {
      setStarting(null);
    }
  }

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: allModules.length };
    allModules.forEach((m) => {
      counts[m.module_type] = (counts[m.module_type] || 0) + 1;
    });
    return counts;
  }, [allModules]);

  useEffect(() => {
    if (!loading && visibleModules.length > 0) {
      const ctx = gsap.context(() => {
        gsap.fromTo(
          ".premium-test-card",
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
        <div className="my-courses-content-wrapper">
          {/* Top Hero Membership Card */}
          <div className="my-courses-hero-card">
            <div className="my-courses-hero-left">
              <h2 className="my-courses-hero-title">
                {access.state === "active" || access.state === "grace" ? access.plan.name : strings.demo.heroTitle}
              </h2>
              <p className="my-courses-hero-desc">
                {access.state === "active" || access.state === "grace"
                  ? access.plan.description || strings.defaultPlanDescription
                  : strings.demo.heroDescription}
              </p>
            </div>
            <div className="my-courses-hero-right">
              {!isInstituteStudent && access.expires_at && (
                <div className="my-courses-validity-tag">
                  <Icon name="due" />
                  <span>{strings.accessUntil(formatDate(access.expires_at))}</span>
                </div>
              )}
              {/* Trial days remaining pill — only for direct demo-access students */}
              {!isInstituteStudent &&
                access.state !== "active" &&
                access.state !== "grace" &&
                access.demo != null &&
                access.demo.is_enabled && (
                  <div
                    className={[
                      "my-courses-trial-badge",
                      access.demo.days_remaining === 0
                        ? "trial-expired"
                        : access.demo.days_remaining != null && access.demo.days_remaining <= 3
                          ? "trial-urgent"
                          : "trial-ok",
                    ].join(" ")}
                    title={
                      access.demo.days_remaining != null && access.demo.days_remaining > 0
                        ? `Trial started ${access.demo.duration_days}-day period`
                        : undefined
                    }
                  >
                    <Icon name="due" />
                    <span>
                      {access.demo.days_remaining === 0
                        ? strings.demo.trialExpired
                        : access.demo.days_remaining === 1
                          ? strings.demo.trialLastDay
                          : strings.demo.trialDaysLeft(access.demo.days_remaining ?? 0)}
                    </span>
                  </div>
                )}
              {!isInstituteStudent && access.state !== "active" && access.state !== "grace" && (
                <Button variant="primary" onClick={() => navigate("/student/courses")}>
                  {strings.demo.browsePlans}
                </Button>
              )}
              <div className="my-courses-count-tag">
                <Icon name="plan" />
                <span>{strings.testsCount(allModules.length)}</span>
              </div>
            </div>
          </div>

          {/* Filter Bar: SegmentedControl + SearchInput */}
          {allModules.length > 0 && (
            <ModuleFilterBar
              availableTypes={availableTypes}
              typeFilter={typeFilter}
              onTypeFilterChange={setTypeFilter}
              search={search}
              onSearchChange={setSearch}
              typeCounts={typeCounts}
            />
          )}

          {/* Test Cards Grid */}
          {!allModules.length ? (
            <p className="empty-message">{isInstituteStudent ? strings.empty.noModulesInstitute : strings.empty.noModulesDirect}</p>
          ) : !visibleModules.length ? (
            <p className="empty-message">{strings.empty.noFilterMatches}</p>
          ) : (
            <AssignedTestsGrid modules={visibleModules} starting={starting} onStartModule={startModule} />
          )}
        </div>
      )}
    </div>
  );
}
