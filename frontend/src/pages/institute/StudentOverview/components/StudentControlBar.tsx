import { Icon } from "@/components/icons";
import type { InstituteMember } from "../types";
import { studentOverviewStrings as strings } from "../StudentOverview.strings";
import { Badge } from "@/components/ui";

interface StudentControlBarProps {
  student: InstituteMember;
  activeSessionCount: number;
  canManage: boolean | undefined;
  canRevokeSessions: boolean | undefined;
  onResetPassword: () => void;
  onRevokeSessions: () => void;
  onToggleActive: () => void;
  onArchive: () => void;
}

export function StudentControlBar({
  student,
  activeSessionCount,
  canManage,
  canRevokeSessions,
  onResetPassword,
  onRevokeSessions,
  onToggleActive,
  onArchive,
}: StudentControlBarProps) {
  const t = strings.status;
  const tips = strings.actionTooltips;
  return (
    <section className="student-control-bar">
      <div>
        <Badge tone={student.deleted_at ? "gray" : student.is_active ? "green" : "inactive"}>
          {student.deleted_at ? t.deleted : student.is_active ? t.active : t.inactive}
        </Badge>
        <span>{student.phone_number ?? t.noPhoneNumber}</span>
      </div>
      {!student.deleted_at && (
        <div className="table-actions">
          {canManage && (
            <button onClick={onResetPassword} aria-label={tips.resetPassword} data-tooltip={tips.resetPassword}>
              <Icon name="lock" />
            </button>
          )}
          {canRevokeSessions && (
            <button
              disabled={!activeSessionCount}
              onClick={onRevokeSessions}
              aria-label={tips.signOutDevice}
              data-tooltip={tips.signOutDevice}
            >
              <Icon name="revoke" />
            </button>
          )}
          {canManage && (
            <button
              className="action-toggle"
              onClick={onToggleActive}
              aria-label={student.is_active ? tips.deactivate : tips.reactivate}
              data-tooltip={student.is_active ? tips.deactivate : tips.reactivate}
            >
              <Icon name={student.is_active ? "toggleOff" : "toggleOn"} />
            </button>
          )}
          {canManage && (
            <button className="danger" onClick={onArchive} aria-label={tips.delete} data-tooltip={tips.delete}>
              <Icon name="trash" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
