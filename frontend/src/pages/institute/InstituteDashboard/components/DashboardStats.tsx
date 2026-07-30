import { MetricCard } from "@/components/dashboard/MetricCard";
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
    <div className="metric-grid">
      {canSeeStudents && (
        <MetricCard label={t.students} value={counts.students} tone="blue" icon="user" />
      )}
      {canSeeStaff && (
        <MetricCard label={t.instructors} value={counts.instructors} tone="green" icon="instructors" />
      )}
      {(canSeeStudents || canSeeStaff) && (
        <MetricCard label={t.activeMembers} value={counts.active_members} tone="purple" icon="session" />
      )}
      {canSeeBilling && (
        <MetricCard label={t.subscription} value={subscriptionState ?? "-"} valueClassName="stat-value-text" tone="amber" icon="subscription" />
      )}
    </div>
  );
}
