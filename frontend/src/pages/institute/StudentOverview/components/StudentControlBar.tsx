import { Icon } from "@/components/icons";
import type { InstituteMember } from "../types";
import { studentOverviewStrings as strings } from "../StudentOverview.strings";
import { Badge } from "@/components/ui";
import { IconButton } from "@/components/ui/IconButton/IconButton";

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
            <IconButton
              icon={<Icon name="lock" />}
              label={tips.resetPassword}
              onClick={onResetPassword}
              data-tooltip={tips.resetPassword}
            />
          )}
          {canRevokeSessions && (
            <IconButton
              icon={<Icon name="revoke" />}
              label={tips.signOutDevice}
              disabled={!activeSessionCount}
              onClick={onRevokeSessions}
              data-tooltip={tips.signOutDevice}
            />
          )}
          {canManage && (
            <IconButton
              icon={<Icon name={student.is_active ? "toggleOff" : "toggleOn"} />}
              label={student.is_active ? tips.deactivate : tips.reactivate}
              className="action-toggle"
              onClick={onToggleActive}
              data-tooltip={student.is_active ? tips.deactivate : tips.reactivate}
            />
          )}
          {canManage && (
            <IconButton
              icon={<Icon name="trash" />}
              label={tips.delete}
              variant="danger"
              onClick={onArchive}
              data-tooltip={tips.delete}
            />
          )}
        </div>
      )}
    </section>
  );
}
