import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@/components/icons";
import { RowActionMenu } from "@/components/RowActionMenu";
import { Badge, Checkbox } from "@/components/ui";
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
  onChangeWindow: (member: InstituteMember) => void;
  onFreeSeat: (member: InstituteMember) => void;
  onReactivateSeat: (member: InstituteMember) => void;
}

/** Status is derived from `access_state`, not `is_active`, because one boolean
 *  cannot tell "deactivated by the institute" from "their course ended" from
 *  "we gave the seat back" - and those three need different buttons. */
function statusOf(member: InstituteMember): { label: string; tone: "gray" | "green" | "amber" | "red" | "inactive" } {
  const t = strings.table;
  if (member.deleted_at) return { label: t.statusDeleted, tone: "gray" };
  if (member.role !== "STUDENT") {
    return member.is_active
      ? { label: t.statusActive, tone: "green" }
      : { label: t.statusSuspended, tone: "inactive" };
  }
  switch (member.access_state) {
    case "released":
      return { label: t.statusReleased, tone: "gray" };
    case "expired":
      return { label: t.statusExpired, tone: "red" };
    case "suspended":
      return { label: t.statusSuspended, tone: "inactive" };
    default:
      return member.window_open
        ? { label: t.statusActive, tone: "green" }
        : { label: t.statusNotStarted, tone: "amber" };
  }
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
  onChangeWindow,
  onFreeSeat,
  onReactivateSeat,
}: MembersTableProps) {
  const t = strings.table;
  const columnCount = 9 + (canManage ? 1 : 0) + (isAllAccounts ? 1 : 0);

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
    const isStudent = member.role === "STUDENT";
    const isReleased = isStudent && member.access_state === "released";

    if (!member.deleted_at && canManage && isStudent) {
      if (isReleased) {
        // A past student. The only thing to do is bring them back - and that
        // costs a seat, which the modal spells out before it is spent.
        actions.push(
          <button
            key="reactivate-seat"
            type="button"
            onClick={() => onReactivateSeat(member)}
            aria-label={strings.actionTooltips.reactivateSeat}
            role="menuitem"
          >
            <Icon name="restore" />
            <span>{strings.actionTooltips.reactivateSeat}</span>
          </button>,
        );
      } else {
        actions.push(
          <button
            key="change-window"
            type="button"
            onClick={() => onChangeWindow(member)}
            aria-label={strings.actionTooltips.changeWindow}
            role="menuitem"
          >
            <Icon name="history" />
            <span>{strings.actionTooltips.changeWindow}</span>
          </button>,
        );
        // Only offered once the student is already locked out. Freeing a seat
        // from under someone mid-course should take two deliberate steps -
        // deactivate, then free - not one misclick on a roster row.
        if (member.access_state === "expired" || member.access_state === "suspended") {
          actions.push(
            <button
              key="free-seat"
              type="button"
              onClick={() => onFreeSeat(member)}
              aria-label={strings.actionTooltips.freeSeat}
              role="menuitem"
            >
              <Icon name="revoke" />
              <span>{strings.actionTooltips.freeSeat}</span>
            </button>,
          );
        }
      }
    }

    if (!member.deleted_at && canManage && !isReleased) {
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
      );
    }

    // Reactivate is hidden once the window has closed, because it cannot work:
    // the service refuses to switch a student back on into a date that has
    // already passed. Offering the button anyway would give an admin one click
    // whose only possible outcome is an error message. Their route back is
    // Change access dates, which is right above it.
    const canToggleActive =
      !member.deleted_at &&
      canManage &&
      !isReleased &&
      (member.is_active || !isStudent || member.access_state !== "expired");

    if (canToggleActive) {
      actions.push(
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
      );
    }

    if (!member.deleted_at && canManage && !isReleased) {
      actions.push(
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
            <th>{t.access}</th>
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
                  {member.force_password_reset && <Badge tone="amber">{t.passwordResetBadge}</Badge>}
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
                {(() => {
                  const status = statusOf(member);
                  return (
                    <div className="member-status-cell">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      {member.role === "STUDENT" && !member.holds_seat && !member.deleted_at && (
                        <span className="muted-text">{t.noSeatHint}</span>
                      )}
                    </div>
                  );
                })()}
              </td>
              <td data-label={t.access}>
                {member.role === "STUDENT" && member.access_ends_on ? (
                  <div className="member-access-cell">
                    <span>{formatDay(member.access_ends_on)}</span>
                    {member.access_state === "active" && member.days_remaining !== null && (
                      <span className="muted-text">{t.daysLeft(member.days_remaining)}</span>
                    )}
                  </div>
                ) : (
                  t.noWindow
                )}
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

/** Renders a bare YYYY-MM-DD as a calendar date.
 *
 *  `new Date("2027-03-31")` parses as midnight UTC and prints as 30 March for
 *  anyone west of Greenwich - an access window would appear to end a day early
 *  for exactly the users this feature is meant to protect. */
function formatDay(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
