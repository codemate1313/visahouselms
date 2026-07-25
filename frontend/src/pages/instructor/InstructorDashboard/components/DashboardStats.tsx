import { instructorDashboardStrings as strings } from "../InstructorDashboard.strings";

interface DashboardStatsProps {
  modules: number;
  drafts: number;
  published: number;
  questions: number;
}

export function DashboardStats({ modules, drafts, published, questions }: DashboardStatsProps) {
  return (
    <div className="stat-tile-row instructor-stats">
      <div className="stat-tile">
        <p className="stat-label">{strings.stats.modules}</p>
        <p className="stat-value">{modules}</p>
      </div>
      <div className="stat-tile">
        <p className="stat-label">{strings.stats.drafts}</p>
        <p className="stat-value">{drafts}</p>
      </div>
      <div className="stat-tile">
        <p className="stat-label">{strings.stats.published}</p>
        <p className="stat-value">{published}</p>
      </div>
      <div className="stat-tile">
        <p className="stat-label">{strings.stats.questions}</p>
        <p className="stat-value">{questions}</p>
      </div>
    </div>
  );
}
