import { moduleControlDetailStrings as strings } from "../ModuleControlDetail.strings";
import type { ManagedModule } from "../types";

interface OverviewCardProps {
  module: ManagedModule;
}

export function OverviewCard({ module }: OverviewCardProps) {
  const f = strings.facts;
  return (
    <div className="detail-card course-overview-card">
      <div className="overview-left">
        <div className="course-status-pills">
          <span className={`badge ${module.status === "published" ? "badge-green" : module.status === "draft" ? "badge-amber" : "badge-gray"}`}>
            {module.status.charAt(0).toUpperCase() + module.status.slice(1)}
          </span>
          {!module.is_visible && <span className="badge badge-gray">{strings.hidden}</span>}
        </div>

        <h2 className="overview-course-type">{module.module_label}</h2>
        <p className="overview-course-desc">{module.description || strings.noDescription}</p>
      </div>

      <div className="overview-facts-grid">
        <div className="overview-fact-box">
          <span className="fact-label">{f.duration}</span>
          <span className="fact-value">
            {module.duration_minutes} {f.minutesSuffix}
          </span>
        </div>
        <div className="overview-fact-box">
          <span className="fact-label">{f.parts}</span>
          <span className="fact-value">{module.part_count}</span>
        </div>
        <div className="overview-fact-box">
          <span className="fact-label">{f.questions}</span>
          <span className="fact-value">{module.question_count}</span>
        </div>
        <div className="overview-fact-box">
          <span className="fact-label">{f.institutes}</span>
          <span className="fact-value">{module.assignment_count}</span>
        </div>
      </div>
    </div>
  );
}
