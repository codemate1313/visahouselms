import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { instructorDashboardStrings as strings } from "./InstructorDashboard.strings";
import { DashboardStats } from "./components/DashboardStats";
import { ModuleAuthoringPanel } from "./components/ModuleAuthoringPanel";
import { ProfileReadinessPanel } from "./components/ProfileReadinessPanel";
import { RecentActivityPanel } from "./components/RecentActivityPanel";
import { PageHeader } from "@/components/ui";

interface Summary {
  profile_completion: number;
  content: {
    modules: number;
    drafts: number;
    published: number;
    questions: number;
    audio: number;
    reading: number;
    speaking: number;
    writing: number;
    listening: number;
    full_mock: number;
    final_test: number;
  };
  grading: { pending: number; in_progress: number; completed_today: number };
  recent_activity: { action: string; entity_type: string; entity_id: number | null; created_at: string | null }[];
}

export function InstructorDashboard() {
  const user = useAuthStore((state) => state.user);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<Summary>("/instructor/dashboard/summary")
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
        modules={summary.content.modules}
        drafts={summary.content.drafts}
        published={summary.content.published}
        questions={summary.content.questions}
      />

      <div className="workspace-grid">
        <ModuleAuthoringPanel
          skillModuleCount={
            summary.content.reading + summary.content.listening + summary.content.writing + summary.content.speaking
          }
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
