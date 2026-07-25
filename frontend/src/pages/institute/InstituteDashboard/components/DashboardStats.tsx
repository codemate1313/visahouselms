import { instituteDashboardStrings as strings } from "../InstituteDashboard.strings";
import type { DashboardSummary } from "../types";

interface DashboardStatsProps {
  counts: DashboardSummary["counts"];
  subscriptionState: string | undefined;
  canSeeStudents: boolean;
  canSeeStaff: boolean;
  canSeeBilling: boolean;
}

export function DashboardStats({ counts, subscriptionState, canSeeStudents, canSeeStaff, canSeeBilling }: DashboardStatsProps) {
  const t = strings.stats;
  return (
    <div className="stat-tile-row">
      {canSeeStudents && (
        <div className="stat-tile">
          <p className="stat-label">{t.students}</p>
          <p className="stat-value">{counts.students}</p>
        </div>
      )}
      {canSeeStaff && (
        <div className="stat-tile">
          <p className="stat-label">{t.instructors}</p>
          <p className="stat-value">{counts.instructors}</p>
        </div>
      )}
      {(canSeeStudents || canSeeStaff) && (
        <div className="stat-tile">
          <p className="stat-label">{t.activeMembers}</p>
          <p className="stat-value">{counts.active_members}</p>
        </div>
      )}
      {canSeeBilling && (
        <div className="stat-tile">
          <p className="stat-label">{t.subscription}</p>
          <p className="stat-value stat-value-text">{subscriptionState}</p>
        </div>
      )}
    </div>
  );
}
