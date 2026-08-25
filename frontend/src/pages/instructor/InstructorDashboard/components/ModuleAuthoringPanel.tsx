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
        <div className="authoring-card-item">
          <div className="item-icon-wrapper">
            <Icon name="courses" style={{ width: 18, height: 18 }} />
          </div>
          <div className="item-content">
            <strong>{t.skillModulesTitle}</strong>
            <div className="item-stats-chips">
              <span className="stat-chip">Reading: {readingCount}</span>
              <span className="stat-chip">Listening: {listeningCount}</span>
              <span className="stat-chip">Writing: {writingCount}</span>
              <span className="stat-chip">Speaking: {speakingCount}</span>
            </div>
          </div>
        </div>

        <div className="authoring-card-item">
          <div className="item-icon-wrapper">
            <Icon name="plan" style={{ width: 18, height: 18 }} />
          </div>
          <div className="item-content">
            <strong>{t.completeTestsTitle}</strong>
            <div className="item-stats-chips">
              <span className="stat-chip">Full Mocks: {fullMockCount}</span>
              <span className="stat-chip">Final Tests: {finalTestCount}</span>
            </div>
          </div>
        </div>

        <div className="authoring-card-item">
          <div className="item-icon-wrapper">
            <Icon name="microphone" style={{ width: 18, height: 18 }} />
          </div>
          <div className="item-content">
            <strong>{t.listeningMediaTitle}</strong>
            <div className="item-stats-chips">
              <span className="stat-chip">Audios & Transcripts: {audioCount}</span>
            </div>
          </div>
        </div>
      </div>
      <Link to="/super-admin/instructor/modules">
        {t.openWorkspace} <Icon name="arrowRight" />
      </Link>
    </section>
  );
}
