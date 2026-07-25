import { instituteDashboardStrings as strings } from "../InstituteDashboard.strings";
import type { MemberSummary } from "../types";

interface RecentMembersPanelProps {
  members: MemberSummary[];
}

export function RecentMembersPanel({ members }: RecentMembersPanelProps) {
  const t = strings.recentMembersPanel;
  return (
    <section className="workspace-panel">
      <div className="panel-heading">
        <div>
          <h2>{t.heading}</h2>
          <p>{t.description}</p>
        </div>
      </div>
      {members.length ? (
        <ul className="activity-list">
          {members.map((member) => (
            <li key={member.id}>
              <span>{member.first_name} {member.last_name}</span>
              <span>{member.role === "STUDENT" ? t.student : t.instructor}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-message">{t.empty}</p>
      )}
    </section>
  );
}
