import { Link } from "react-router-dom";
import { instructorDashboardStrings as strings } from "../InstructorDashboard.strings";
import { Icon } from "@/components/icons";

interface ProfileReadinessPanelProps {
  completion: number;
  profilePath?: string;
}

export function ProfileReadinessPanel({ completion, profilePath = "/super-admin/instructor/profile" }: ProfileReadinessPanelProps) {
  const t = strings.profileReadiness;
  return (
    <section className="workspace-panel">
      <div className="panel-heading">
        <div>
          <h2>{t.title}</h2>
          <p>{t.description}</p>
        </div>
        <strong>{completion}%</strong>
      </div>
      <div className="progress-track">
        <span style={{ width: `${completion}%` }} />
      </div>
      {completion < 100 && <Link to={profilePath}>
          {t.completeYourProfile} <Icon name="arrowRight" />
        </Link>}
    </section>
  );
}
