import { MetricCard } from "@/components/dashboard/MetricCard";
import { instructorDashboardStrings as strings } from "../InstructorDashboard.strings";

interface DashboardStatsProps {
  gradings: number;
  learners: number;
  published: number;
  attempts: number;
}

export function DashboardStats({ gradings, learners, published, attempts }: DashboardStatsProps) {
  return (
    <div className="metric-grid instructor-stats">
      <MetricCard label={strings.stats.gradings} value={gradings} tone="purple" icon="grading" />
      <MetricCard label={strings.stats.learners} value={learners} tone="blue" icon="user" />
      <MetricCard label={strings.stats.published} value={published} tone="green" icon="check" />
      <MetricCard label={strings.stats.attempts} value={attempts} tone="amber" icon="analytics" />
    </div>
  );
}
