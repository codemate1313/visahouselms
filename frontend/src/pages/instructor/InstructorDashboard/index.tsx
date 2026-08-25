import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { instructorDashboardStrings as strings } from "./InstructorDashboard.strings";
import { DashboardStats } from "./components/DashboardStats";
import { ModuleAuthoringPanel } from "./components/ModuleAuthoringPanel";
import { ProfileReadinessPanel } from "./components/ProfileReadinessPanel";
import { RecentActivityPanel } from "./components/RecentActivityPanel";
import { InstructorImpactPanel } from "./components/InstructorImpactPanel";
import { InstructorAnalytics } from "./components/InstructorAnalytics";
import { CourseUsagePanel } from "./components/CourseUsagePanel";
import { PageHeader } from "@/components/ui";
import type { InstructorDashboardSummary } from "./types";

export function InstructorDashboard() {
  const user = useAuthStore((state) => state.user);
  const [summary, setSummary] = useState<InstructorDashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<InstructorDashboardSummary>("/instructor/dashboard/summary")
      .then(({ data }) => setSummary(data))
      .catch(() => setError(strings.errors.load));
  }, []);

  if (error) return <p className="error-text">{error}</p>;
  if (!summary) return <p>{strings.loading}</p>;

  return (
    <div>
      <PageHeader
        eyebrow={strings.eyebrow}
        title={strings.welcome(user?.first_name)}
        subtitle={strings.subtitle}
      />

      <DashboardStats
        gradings={summary.grading.completed_total}
        learners={summary.engagement.unique_learners}
        published={summary.content.published}
        attempts={summary.engagement.total_attempts}
      />

      <div className="instructor-impact-layout">
        <InstructorImpactPanel
          publishedCourses={summary.content.published}
          coursesWithUsage={summary.engagement.courses_with_usage}
          totalAttempts={summary.engagement.total_attempts}
          completedAttempts={summary.engagement.completed_attempts}
          completedThisMonth={summary.grading.completed_this_month}
          inProgressGradings={summary.grading.in_progress}
        />
        <InstructorAnalytics courseUsage={summary.course_usage} gradingTrend={summary.grading_trend} />
      </div>

      <CourseUsagePanel courses={summary.course_usage} />

      <div className="workspace-grid">
        <ModuleAuthoringPanel
          readingCount={summary.content.reading}
          listeningCount={summary.content.listening}
          writingCount={summary.content.writing}
          speakingCount={summary.content.speaking}
          fullMockCount={summary.content.full_mock}
          finalTestCount={summary.content.final_test}
          audioCount={summary.content.audio}
        />
        <ProfileReadinessPanel completion={summary.profile_completion} />
        <RecentActivityPanel activity={summary.recent_activity} />
      </div>
    </div>
  );
}
