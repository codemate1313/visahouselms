import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import type { StudentBadge, StudentLeaderboard } from "@/api/types";
import { PageHeader } from "@/components/ui";
import { studentProgressStrings as strings } from "./StudentProgress.strings";
import { ProgressStatTiles } from "./components/ProgressStatTiles";
import { BadgesPanel } from "./components/BadgesPanel";
import { LeaderboardPanel } from "./components/LeaderboardPanel";
import { useAuthStore } from "@/store/authStore";

export function StudentProgress() {
  const user = useAuthStore((state) => state.user);
  const isInstituteStudent = user?.institute_id != null;

  const [badges, setBadges] = useState<StudentBadge[] | null>(null);
  const [leaderboard, setLeaderboard] = useState<StudentLeaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<"institute" | "global">(
    useAuthStore.getState().user?.institute_id != null ? "institute" : "global"
  );

  useEffect(() => {
    setScope(isInstituteStudent ? "institute" : "global");
  }, [isInstituteStudent]);

  useEffect(() => {
    async function load() {
      try {
        // Achievement refresh also updates the persisted institute standings,
        // so load it before reading the leaderboard snapshot.
        const badgeResponse = await apiClient.get<StudentBadge[]>("/student/achievements");
        const leaderboardResponse = await apiClient.get<StudentLeaderboard>(`/student/leaderboard?scope=${scope}`);
        setBadges(badgeResponse.data);
        setLeaderboard(leaderboardResponse.data);
      } catch {
        setError(strings.loadError);
      }
    }
    load();
  }, [scope]);

  if (error) return <p className="error-text">{error}</p>;
  if (!badges || !leaderboard) return <p>{strings.loading}</p>;

  const earned = badges.filter((badge) => badge.earned);

  return (
    <div>
      <PageHeader eyebrow={strings.eyebrow} title={strings.title} subtitle={strings.subtitle} />

      <LeaderboardPanel
        leaderboard={leaderboard}
        scope={scope}
        onScopeChange={setScope}
        isInstituteStudent={isInstituteStudent}
      />
      <ProgressStatTiles badges={badges} earnedCount={earned.length} leaderboard={leaderboard} />
      <BadgesPanel badges={badges} earnedCount={earned.length} />
    </div>
  );
}
