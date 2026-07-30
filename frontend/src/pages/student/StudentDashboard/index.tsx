import { useEffect, useRef, useState } from "react";
import { apiClient } from "@/api/client";
import type { AttemptSummary, StudentCurrentPlan } from "@/api/types";
import { useAuthStore } from "@/store/authStore";
import { studentDashboardStrings as strings } from "./StudentDashboard.strings";
import { COMPLETED_STATUSES, attemptTime, progressForStatus, statusLabel } from "./helpers";
import { useDashboardAnimations } from "./useDashboardAnimations";
import { StatCardsGrid, type StatCard } from "./components/StatCardsGrid";
import { LearningPlanPanel } from "./components/LearningPlanPanel";
import { RecentActivityPanel } from "./components/RecentActivityPanel";
import type { TestProgressItem } from "./types";

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
      .catch(() => setError(strings.loadError));
  }, []);

  useDashboardAnimations(containerRef, Boolean(attempts && myPlan));

  if (error) return <p className="error-text">{error}</p>;
  if (!attempts || !myPlan) return <p>{strings.loading}</p>;

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
  const testProgress: TestProgressItem[] = assignedModules.map((module) => {
    const moduleId = module.module_id ?? module.id ?? 0;
    const latestAttempt = latestAttemptByModule.get(moduleId);
    const progress = progressForStatus(latestAttempt?.status);
    return {
      module,
      moduleId,
      latestAttempt,
      progress,
      statusLabel: latestAttempt ? statusLabel(latestAttempt.status) : strings.notStarted,
    };
  });
  const completedTests = testProgress.filter((item) => item.latestAttempt && COMPLETED_STATUSES.has(item.latestAttempt.status)).length;
  const pendingTests = Math.max(assignedModules.length - completedTests, 0);

  const statCards: StatCard[] = [
    { key: "available", label: strings.stats.available, value: myPlan.plan?.modules.length ?? 0, tone: "blue" },
    { key: "completed", label: strings.stats.completed, value: completedTests, tone: "green" },
    { key: "pending", label: strings.stats.pending, value: pendingTests, tone: "slate" },
    { key: "in_progress", label: strings.stats.inProgress, value: inProgress, tone: "purple" },
    { key: "awaiting", label: strings.stats.awaitingGrading, value: pendingGrading, tone: "amber" },
    { key: "graded", label: strings.stats.graded, value: graded, tone: "green" },
  ];

  return (
    <div className="sd-dashboard" ref={containerRef}>
      <div className="page-header">
        <div>
          <span className="page-eyebrow">{strings.eyebrow}</span>
          <h1>{strings.welcome(user?.first_name)}</h1>
          <p className="page-subtitle">{strings.subtitle}</p>
        </div>
      </div>

      <StatCardsGrid stats={statCards} />

      <div className="sd-grid">
        <LearningPlanPanel
          isInstituteStudent={isInstituteStudent}
          plan={myPlan.plan}
          testProgress={testProgress}
          completedTests={completedTests}
          pendingTests={pendingTests}
        />
        <RecentActivityPanel attempts={attempts} />
      </div>
    </div>
  );
}
