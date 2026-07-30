import { MetricCard } from "@/components/dashboard/MetricCard";
import { instructorDashboardStrings as strings } from "../InstructorDashboard.strings";

interface DashboardStatsProps {
  modules: number;
  drafts: number;
  published: number;
  questions: number;
}

export function DashboardStats({ modules, drafts, published, questions }: DashboardStatsProps) {
  return (
    <div className="metric-grid instructor-stats">
      <MetricCard label={strings.stats.modules} value={modules} tone="blue" icon="module" />
      <MetricCard label={strings.stats.drafts} value={drafts} tone="slate" icon="edit" />
      <MetricCard label={strings.stats.published} value={published} tone="green" icon="check" />
      <MetricCard label={strings.stats.questions} value={questions} tone="purple" icon="help" />
    </div>
  );
}
