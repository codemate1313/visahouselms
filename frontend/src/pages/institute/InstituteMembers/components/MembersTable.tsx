import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@/components/icons";
import { RowActionMenu } from "@/components/RowActionMenu";
import { Checkbox } from "@/components/ui";
import type { InstituteMember } from "../types";
import { instituteMembersStrings as strings } from "../InstituteMembers.strings";
import { formatDate } from "@/utils/date";

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
  const columnCount = 8 + (canManage ? 1 : 0) + (isAllAccounts ? 1 : 0);

  function rowActions(member: InstituteMember): ReactElement[] {
    const actions: ReactElement[] = [];

    if (member.role === "STUDENT" && canViewActivity) {
      actions.push(
        <Link
          key="view"
          to={`${basePath}/students/${member.id}`}
          aria-label={strings.actionTooltips.view}
          role="menuitem"
        >
          <Icon name="overview" />
          <span>{strings.actionTooltips.view}</span>
        </Link>,
      );
    }
    if (canManage) {
      actions.push(
        <Link
          key="edit"
          to={`${basePath}/${member.role === "STUDENT" ? "students" : "staff"}/${member.id}/edit`}
          aria-label={strings.actionTooltips.edit}
          role="menuitem"
        >
          <Icon name="edit" />
          <span>{strings.actionTooltips.edit}</span>
        </Link>,
      );
    }
    if (!member.deleted_at && canManage) {
      actions.push(
        <button
          key="reset-password"
          type="button"
          onClick={() => onResetPassword(member)}
          aria-label={strings.actionTooltips.resetPassword}
          role="menuitem"
        >
          <Icon name="lock" />
          <span>{strings.actionTooltips.resetPassword}</span>
        </button>,
        <button
          key="toggle-active"
          type="button"
          onClick={() => onToggleActive(member)}
          aria-label={member.is_active ? strings.actionTooltips.deactivate : strings.actionTooltips.reactivate}
          role="menuitem"
        >
          <Icon name={member.is_active ? "toggleOff" : "toggleOn"} />
          <span>{member.is_active ? strings.actionTooltips.deactivate : strings.actionTooltips.reactivate}</span>
        </button>,
        <button
          key="delete"
          type="button"
          className="danger"
          onClick={() => onRemove(member)}
          aria-label={strings.actionTooltips.delete}
          role="menuitem"
        >
          <Icon name="trash" />
          <span>{strings.actionTooltips.delete}</span>
        </button>,
      );
    }

    return actions;
  }

  return (
    <div className="table-wrap">
      <table className="data-table responsive-data-table sleek-users-table institute-members-table">
        <thead>
          <tr>
            {canManage && (
              <th className="table-select-heading">
                <Checkbox
                  aria-label={`Select all ${label.toLowerCase()}`}
                  checked={selectableMembers.length > 0 && selectedIds.size === selectableMembers.length}
                  indeterminate={selectedIds.size > 0 && selectedIds.size < selectableMembers.length}
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
                    <Checkbox
                      aria-label={`Select ${member.first_name} ${member.last_name}`}
                      checked={selectedIds.has(member.id)}
                      onChange={() => onToggleSelect(member.id)}
                    />
                  )}
                </td>
              )}
              <td data-label={t.name}>
                <div className="member-name-cell">
                  <strong>
                    {member.first_name} {member.last_name}
                  </strong>
                  {member.force_password_reset && <span className="badge badge-amber">{t.passwordResetBadge}</span>}
                </div>
              </td>
              <td data-label={t.email}>{member.email}</td>
              {isAllAccounts && <td data-label={t.type}>{member.role === "STUDENT" ? "Student" : "Instructor"}</td>}
              <td data-label={t.tests}>{member.attempt_count}</td>
              <td data-label={t.devices}>
                {member.device_count}
                <span className="muted-text device-active-label">
                  {member.active_session_count ? `${member.active_session_count} active` : ""}
                </span>
              </td>
              <td data-label={t.contact}>{member.phone_number ?? "-"}</td>
              <td data-label={t.status}>
                <span
                  className={`badge ${member.deleted_at ? "badge-gray" : member.is_active ? "badge-green" : "badge-inactive"}`}
                >
                  {member.deleted_at ? "Deleted" : member.is_active ? "Active" : "Inactive"}
                </span>
              </td>
              <td data-label={t.created}>{formatDate(member.created_at)}</td>
              <td className="table-actions institute-row-actions" data-label={t.actions}>
                {(canManage || (member.role === "STUDENT" && canViewActivity)) && (
                  <RowActionMenu
                    label={`Actions for ${member.first_name} ${member.last_name}`}
                    items={rowActions(member)}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
