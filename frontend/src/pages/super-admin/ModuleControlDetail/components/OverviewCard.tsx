import { moduleControlDetailStrings as strings } from "../ModuleControlDetail.strings";
import type { ManagedModule } from "../types";
import { Badge } from "@/components/ui";

interface OverviewCardProps {
  module: ManagedModule;
}

export function OverviewCard({ module }: OverviewCardProps) {
  const f = strings.facts;
  return (
    <div className="detail-card course-overview-card">
      <div className="overview-left">
        <div className="course-status-pills">
          <Badge tone={module.status === "published" ? "green" : module.status === "draft" ? "amber" : "gray"}>
            {module.status.charAt(0).toUpperCase() + module.status.slice(1)}
          </Badge>
          {!module.is_visible && <Badge tone="gray">{strings.hidden}</Badge>}
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
