import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import type { StudentBadge, StudentLeaderboard } from "@/api/types";
import { studentProgressStrings as strings } from "./StudentProgress.strings";
import { ProgressStatTiles } from "./components/ProgressStatTiles";
import { BadgesPanel } from "./components/BadgesPanel";
import { LeaderboardPanel } from "./components/LeaderboardPanel";

export function StudentProgress() {
  const [badges, setBadges] = useState<StudentBadge[] | null>(null);
  const [leaderboard, setLeaderboard] = useState<StudentLeaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<"institute" | "global">("institute");

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
      <div className="page-header">
        <div>
          <span className="page-eyebrow">{strings.eyebrow}</span>
          <h1>{strings.title}</h1>
          <p className="page-subtitle">{strings.subtitle}</p>
        </div>
      </div>

      <LeaderboardPanel
        leaderboard={leaderboard}
        scope={scope}
        onScopeChange={setScope}
      />
      <ProgressStatTiles badges={badges} earnedCount={earned.length} leaderboard={leaderboard} />
      <BadgesPanel badges={badges} earnedCount={earned.length} />
    </div>
  );
}
