import { Link } from "react-router-dom";
import { Icon } from "@/components/icons";
import type { InstituteMember } from "../types";
import { instituteMembersStrings as strings } from "../InstituteMembers.strings";

interface MembersTableProps {
  label: string;
  members: InstituteMember[];
  selectableMembers: InstituteMember[];
  selectedIds: Set<number>;
  canManage: boolean | undefined;
  canViewActivity: boolean | undefined;
  isAllAccounts: boolean;
  basePath: string;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  onResetPassword: (member: InstituteMember) => void;
  onToggleActive: (member: InstituteMember) => void;
  onRemove: (member: InstituteMember) => void;
}

export function MembersTable({
  label,
  members,
  selectableMembers,
  selectedIds,
  canManage,
  canViewActivity,
  isAllAccounts,
  basePath,
  onToggleSelect,
  onToggleSelectAll,
  onResetPassword,
  onToggleActive,
  onRemove,
}: MembersTableProps) {
  const t = strings.table;
  const columnCount = canManage ? 10 : 9;

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {canManage && (
              <th className="table-select-heading">
                <input
                  type="checkbox"
                  aria-label={`Select all ${label.toLowerCase()}`}
                  checked={selectableMembers.length > 0 && selectedIds.size === selectableMembers.length}
                  ref={(el) => {
                    if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < selectableMembers.length;
                  }}
                  onChange={onToggleSelectAll}
                />
              </th>
            )}
            <th>{t.name}</th>
            <th>{t.email}</th>
            {isAllAccounts && <th>{t.type}</th>}
            <th>{t.tests}</th>
            <th>{t.devices}</th>
            <th>{t.contact}</th>
            <th>{t.status}</th>
            <th>{t.created}</th>
            <th className="table-actions-heading">{t.actions}</th>
          </tr>
        </thead>
        <tbody>
          {members.length === 0 && (
            <tr>
              <td colSpan={columnCount} className="empty-cell">
                {t.emptyRow(label)}
              </td>
            </tr>
          )}
          {members.map((member) => (
            <tr key={member.id}>
              {canManage && (
                <td className="table-select-cell">
                  {!member.deleted_at && (
                    <input
                      type="checkbox"
                      aria-label={`Select ${member.first_name} ${member.last_name}`}
                      checked={selectedIds.has(member.id)}
                      onChange={() => onToggleSelect(member.id)}
                    />
                  )}
                </td>
              )}
              <td>
                <strong>
                  {member.first_name} {member.last_name}
                </strong>
                {member.force_password_reset && <span className="badge badge-amber">{t.passwordResetBadge}</span>}
              </td>
              <td>{member.email}</td>
              {isAllAccounts && <td>{member.role === "STUDENT" ? "Student" : "Instructor"}</td>}
              <td>{member.attempt_count}</td>
              <td>
                {member.device_count}
                <span className="muted-text device-active-label">
                  {member.active_session_count ? `${member.active_session_count} active` : ""}
                </span>
              </td>
              <td>{member.phone_number ?? "-"}</td>
              <td>
                <span
                  className={`badge ${member.deleted_at ? "badge-gray" : member.is_active ? "badge-green" : "badge-inactive"}`}
                >
                  {member.deleted_at ? "Deleted" : member.is_active ? "Active" : "Inactive"}
                </span>
              </td>
              <td>{new Date(member.created_at).toLocaleDateString()}</td>
              <td className="table-actions">
                {member.role === "STUDENT" && canViewActivity && (
                  <Link
                    to={`${basePath}/students/${member.id}`}
                    aria-label={strings.actionTooltips.view}
                    data-tooltip={strings.actionTooltips.view}
                  >
                    <Icon name="overview" />
                  </Link>
                )}
                {canManage && (
                  <Link
                    to={`${basePath}/${member.role === "STUDENT" ? "students" : "staff"}/${member.id}/edit`}
                    aria-label={strings.actionTooltips.edit}
                    data-tooltip={strings.actionTooltips.edit}
                  >
                    <Icon name="edit" />
                  </Link>
                )}
                {!member.deleted_at && canManage && (
                  <button
                    onClick={() => onResetPassword(member)}
                    aria-label={strings.actionTooltips.resetPassword}
                    data-tooltip={strings.actionTooltips.resetPassword}
                  >
                    <Icon name="lock" />
                  </button>
                )}
                {!member.deleted_at && canManage && (
                  <button
                    onClick={() => onToggleActive(member)}
                    aria-label={member.is_active ? strings.actionTooltips.deactivate : strings.actionTooltips.reactivate}
                    data-tooltip={member.is_active ? strings.actionTooltips.deactivate : strings.actionTooltips.reactivate}
                  >
                    <Icon name={member.is_active ? "toggleOff" : "toggleOn"} />
                  </button>
                )}
                {!member.deleted_at && canManage && (
                  <button
                    className="danger"
                    onClick={() => onRemove(member)}
                    aria-label={strings.actionTooltips.delete}
                    data-tooltip={strings.actionTooltips.delete}
                  >
                    <Icon name="trash" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
