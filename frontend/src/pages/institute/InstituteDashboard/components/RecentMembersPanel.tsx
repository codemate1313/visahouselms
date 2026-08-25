import { instituteDashboardStrings as strings } from "../InstituteDashboard.strings";
import type { MemberSummary } from "../types";
import { formatDate } from "@/utils/date";

interface RecentMembersPanelProps {
  members: MemberSummary[];
}

export function RecentMembersPanel({ members }: RecentMembersPanelProps) {
  const t = strings.recentMembersPanel;

  function getInitials(member: MemberSummary) {
    return `${member.first_name[0] ?? ""}${member.last_name[0] ?? ""}`.toUpperCase() || "M";
  }

  return (
    <section className="workspace-panel recent-members-panel">
      <div className="panel-heading recent-members-heading">
        <div>
          <h2>{t.heading}</h2>
          <p>{t.description}</p>
        </div>
        {members.length > 0 && <span className="recent-members-count">{members.length} latest</span>}
      </div>
      {members.length ? (
        <ul className="recent-member-list">
          {members.map((member) => (
            <li key={member.id}>
              <span className="recent-member-avatar">{getInitials(member)}</span>
              <span className="recent-member-main">
                <strong>{member.first_name} {member.last_name}</strong>
                <span>{member.email}</span>
              </span>
              <span className="recent-member-side">
                <span className={`recent-member-role ${member.role === "STUDENT" ? "is-student" : "is-instructor"}`}>
                  {member.role === "STUDENT" ? t.student : t.instructor}
                </span>
                <time dateTime={member.created_at}>{formatDate(member.created_at)}</time>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-message">{t.empty}</p>
      )}
    </section>
  );
}
