import { Link } from "react-router-dom";
import { instructorDashboardStrings as strings } from "../InstructorDashboard.strings";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui";

interface ModuleAuthoringPanelProps {
  readingCount: number;
  listeningCount: number;
  writingCount: number;
  speakingCount: number;
  fullMockCount: number;
  finalTestCount: number;
  audioCount: number;
}

export function ModuleAuthoringPanel({
  readingCount,
  listeningCount,
  writingCount,
  speakingCount,
  fullMockCount,
  finalTestCount,
  audioCount,
}: ModuleAuthoringPanelProps) {
  const t = strings.moduleAuthoring;
  return (
    <section className="workspace-panel">
      <div className="panel-heading">
        <div>
          <h2>{t.title}</h2>
          <p>{t.description}</p>
        </div>
        <Badge tone="green">{t.badge}</Badge>
      </div>
      <div className="authoring-actions">
        <div>
          <strong>{t.skillModulesTitle}</strong>
          <p>{t.skillModulesDetail({ reading: readingCount, listening: listeningCount, writing: writingCount, speaking: speakingCount })}</p>
        </div>
        <div>
          <strong>{t.completeTestsTitle}</strong>
          <p>{t.completeTestsDetail(fullMockCount, finalTestCount)}</p>
        </div>
        <div>
          <strong>{t.listeningMediaTitle}</strong>
          <p>{t.listeningMediaDetail(audioCount)}</p>
        </div>
      </div>
      <Link to="/super-admin/instructor/modules">
        {t.openWorkspace} <Icon name="arrowRight" />
      </Link>
    </section>
  );
}
