import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { apiClient } from "../../api/client";
import type { AttemptSummary, ExamModuleType, StudentCurrentPlan } from "../../api/types";
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

const MODULE_TONE: Record<ExamModuleType, string> = {
  reading: "blue",
  writing: "purple",
  listening: "emerald",
  speaking: "amber",
  full_mock: "primary",
  final_test: "slate",
};

function moduleTone(type: string) {
  return MODULE_TONE[type as ExamModuleType] ?? "slate";
}

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

function StatSvg({ children }: { children: ReactNode }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const STAT_ICONS: Record<string, ReactNode> = {
  available: (
    <StatSvg>
      <rect x="5" y="4" width="14" height="17" rx="2.4" />
      <path d="M9 3.4h6a.6.6 0 0 1 .6.6v1.4H8.4V4a.6.6 0 0 1 .6-.6Z" />
      <path d="M9 11h6M9 15h4" />
    </StatSvg>
  ),
  completed: (
    <StatSvg>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.4 12.3l2.4 2.4 4.8-4.8" />
    </StatSvg>
  ),
  pending: (
    <StatSvg>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </StatSvg>
  ),
  in_progress: (
    <StatSvg>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10 8.3l5 3.7-5 3.7V8.3Z" />
    </StatSvg>
  ),
  awaiting: (
    <StatSvg>
      <path d="M6 20.5V4" />
      <path d="M6 4.5h11l-2.6 3.6L17 11.5H6" />
    </StatSvg>
  ),
  graded: (
    <StatSvg>
      <circle cx="12" cy="8.5" r="4.7" />
      <path d="M9 12.7L7.2 20l4.8-2.8 4.8 2.8-1.8-7.3" />
    </StatSvg>
  ),
};

export function StudentDashboard() {
  const user = useAuthStore((state) => state.user);
  const [attempts, setAttempts] = useState<AttemptSummary[] | null>(null);
  const [myPlan, setMyPlan] = useState<StudentCurrentPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  useLayoutEffect(() => {
    if (!attempts || !myPlan || !containerRef.current) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    const ctx = gsap.context(() => {
      // 1. Entrance Animations
      const tl = gsap.timeline();

      tl.fromTo(".sd-stat-card", 
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          stagger: 0.08,
          ease: "power4.out",
          clearProps: "transform,opacity"
        }, 
        0.15
      );

      tl.fromTo(".sd-panel", 
        { y: 60, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1.2,
          stagger: 0.2,
          ease: "expo.out",
          clearProps: "transform,opacity"
        }, 
        0.35
      );

      tl.fromTo(".sd-test-card", 
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.08,
          ease: "power3.out",
          clearProps: "transform,opacity"
        }, 
        0.6
      );

      tl.fromTo(".sd-activity-item", 
        { x: -30, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.06,
          ease: "power3.out",
          clearProps: "transform,opacity"
        }, 
        0.7
      );

      // 2. Stat Numbers Animation
      gsap.utils.toArray<HTMLElement>(".sd-stat-value", containerRef.current).forEach((el) => {
        const target = Number(el.dataset.value ?? 0);
        const proxy = { val: 0 };
        gsap.to(proxy, {
          val: target,
          duration: 1.2,
          delay: 0.3,
          ease: "power2.out",
          onUpdate: () => {
            el.textContent = String(Math.round(proxy.val));
          },
        });
      });

      // 3. Progress Bars Fill
      gsap.utils.toArray<HTMLElement>(".sd-progress-fill", containerRef.current).forEach((el, index) => {
        const target = Number(el.dataset.progress ?? 0);
        gsap.fromTo(
          el,
          { width: "0%" },
          { width: `${target}%`, duration: 1, delay: 0.8 + index * 0.05, ease: "power3.out" },
        );
      });
    }, containerRef);

    return () => ctx.revert();
  }, [attempts, myPlan]);

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

  const statCards = [
    { key: "available", label: "Available tests", value: myPlan.plan?.modules.length ?? 0, tone: "blue" },
    { key: "completed", label: "Completed", value: completedTests, tone: "emerald" },
    { key: "pending", label: "Pending", value: pendingTests, tone: "slate" },
    { key: "in_progress", label: "In progress", value: inProgress, tone: "purple" },
    { key: "awaiting", label: "Awaiting grading", value: pendingGrading, tone: "amber" },
    { key: "graded", label: "Graded", value: graded, tone: "primary" },
  ];

  return (
    <div className="sd-dashboard" ref={containerRef}>

      <div className="sd-stat-grid">
        {statCards.map((stat) => (
          <div className="sd-stat-card" data-tone={stat.tone} key={stat.key}>
            <div className="sd-stat-content">
              <p className="sd-stat-value" data-value={stat.value}>0</p>
              <p className="sd-stat-label">{stat.label}</p>
            </div>
            <span className="sd-stat-icon">{STAT_ICONS[stat.key]}</span>
          </div>
        ))}
      </div>

      <div className="sd-grid">
        <section className="sd-panel">
          <div className="sd-panel-head">
            <div>
              <h2>{isInstituteStudent ? "Institute assigned tests" : "Your learning plan"}</h2>
              <p>{isInstituteStudent ? "Only tests allotted to your institute are available here." : "Tests included in your current plan."}</p>
            </div>
            {myPlan.plan && testProgress.length > 0 && (
              <div className="sd-progress-summary">
                <span><strong>{completedTests}</strong> completed</span>
                <span><strong>{pendingTests}</strong> pending</span>
              </div>
            )}
          </div>
          {myPlan.plan && testProgress.length ? (
            <div className="sd-test-list">
              {testProgress.map((item) => (
                <article className="sd-test-card" data-tone={moduleTone(item.module.module_type)} key={item.moduleId || item.module.title}>
                  <div className="sd-test-card-top">
                    <div>
                      <span className="sd-test-type">{item.module.module_type.replaceAll("_", " ")}</span>
                      <h3>{item.module.title}</h3>
                    </div>
                    <strong className="sd-test-percent">{item.progress}%</strong>
                  </div>
                  <div className="sd-test-meta">
                    <span>{item.statusLabel}</span>
                    <span>{item.module.duration_minutes} min</span>
                  </div>
                  <div className="sd-progress-track" aria-label={`${item.module.title} progress ${item.progress}%`}>
                    <span className="sd-progress-fill" data-progress={item.progress} style={{ width: `${item.progress}%` }} />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="sd-empty">{isInstituteStudent ? "No tests are currently assigned. Contact your institute administrator." : "No active plan. Choose a plan to begin."}</p>
          )}
          <Link className="sd-panel-link" to="/student/my-courses">Go to My Tests <span aria-hidden="true">→</span></Link>
        </section>
        <section className="sd-panel">
          <div className="sd-panel-head">
            <div>
              <h2>Recent test activity</h2>
              <p>Your most recent attempts across all courses.</p>
            </div>
          </div>
          {attempts.length ? (
            <ul className="sd-activity-list">
              {attempts.slice(0, 6).map((attempt) => (
                <li className="sd-activity-item" data-tone={statusTone(attempt.status)} key={attempt.id}>
                  <span className="sd-activity-dot" />
                  <div className="sd-activity-body">
                    <div className="sd-activity-main">
                      <span className="sd-test-type">{attempt.module_type.replaceAll("_", " ")}</span>
                      <strong>{attempt.module_title}</strong>
                      <small>{formatAttemptDate(attempt)}{attempt.band_label ? ` · ${attempt.band_label}` : ""}</small>
                    </div>
                    <div className="sd-activity-side">
                      <span className={`sd-status-pill is-${statusTone(attempt.status)}`}>
                        {STATUS_LABEL[attempt.status] ?? attempt.status}
                      </span>
                      {attempt.raw_score && attempt.max_score && (
                        <small>{Number(attempt.raw_score).toFixed(0)} / {Number(attempt.max_score).toFixed(0)}</small>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sd-empty">No test attempts yet.</p>
          )}
          <Link className="sd-panel-link" to="/student/attempts">View full history <span aria-hidden="true">→</span></Link>
        </section>
      </div>
    </div>
  );
}
