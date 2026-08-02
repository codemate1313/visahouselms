import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@/components/icons";
import { RowActionMenu } from "@/components/RowActionMenu";
import { TableAvatar } from "@/components/TableAvatar";
import { Checkbox, DataTableCard } from "@/components/ui";
import type { DirectoryUser } from "@/api/types";
import { usersStrings as strings } from "../Users.strings";
import {
  ROLE_ACTIONS,
  canDeleteMember,
  isProtected,
  memberActionBase,
  memberEditPath,
  passwordResetPath,
  tenantManageLink,
} from "../userActions";

interface UsersTableProps {
  users: DirectoryUser[];
  loading?: boolean;
  currentUserId: number | undefined;
  /** Whether the signed-in viewer is the application owner. */
  viewerIsOwner: boolean;
  /** Whether the institute column is meaningful for the active tab. */
  showInstitute: boolean;
  onToggleActive: (user: DirectoryUser) => void;
  onForceReset: (user: DirectoryUser) => void;
  onResetPassword: (user: DirectoryUser) => void;
  onRequestDelete: (user: DirectoryUser) => void;
  /** Empty for tenant-scoped tabs, which have no directory-level bulk actions. */
  selectableRows: DirectoryUser[];
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  onInspectUser?: (user: DirectoryUser) => void;
}

function SkeletonRow({ showInstitute, selectable }: { showInstitute: boolean; selectable: boolean }) {
  return (
    <tr className="table-skeleton-row">
      {selectable && (
        <td className="col-checkbox">
          <div className="skeleton-element skeleton-checkbox" />
        </td>
      )}
      <td className="col-name">
        <div className="table-item-cell" style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div className="skeleton-element skeleton-avatar" />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="skeleton-element skeleton-text-title" />
            <div className="skeleton-element skeleton-text-subtitle" />
          </div>
        </div>
      </td>
      <td className="col-email">
        <div className="skeleton-element skeleton-text-email" />
      </td>
      {showInstitute && (
        <td className="col-institute">
          <div className="skeleton-element skeleton-text-institute" />
        </td>
      )}
      <td className="col-status">
        <div className="skeleton-element skeleton-badge" />
      </td>
      <td className="col-password">
        <div className="skeleton-element skeleton-badge" />
      </td>
      <td className="col-created">
        <div className="skeleton-element skeleton-text-date" />
      </td>
      <td className="col-actions">
        <div className="skeleton-element skeleton-actions" style={{ marginLeft: "auto" }} />
      </td>
    </tr>
  );
}

function formatCompactDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  }).format(new Date(value));
}

function formatDaysAgo(value: string) {
  const changedTime = new Date(value).getTime();
  if (Number.isNaN(changedTime)) return formatCompactDate(value);

  const days = Math.max(0, Math.floor((Date.now() - changedTime) / 86_400_000));
  if (days === 0) return "Today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

export function UsersTable({
  users,
  loading = false,
  currentUserId,
  viewerIsOwner,
  showInstitute,
  onToggleActive,
  onForceReset,
  onResetPassword,
  onRequestDelete,
  selectableRows,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onInspectUser,
}: UsersTableProps) {
  const handleRowClick = (e: React.MouseEvent, user: DirectoryUser) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("a") ||
      target.closest("input[type='checkbox']") ||
      target.closest(".col-checkbox") ||
      target.closest(".col-actions")
    ) {
      return;
    }
    onInspectUser?.(user);
  };
  const selectable = selectableRows.length > 0;
  const t = strings.columns;
  const b = strings.badges;
  const a = strings.actions;
  const p = strings.passwordTrail;

  function renderActions(user: DirectoryUser) {
    if (isProtected(user)) {
      return <span className="badge badge-gray">{a.protected}</span>;
    }

    // Only the owner account may create, edit, deactivate, delete, or reset
    // a Super Admin account from here (self-service goes through "My
    // Profile" instead).
    if (user.role_name === "SUPER_ADMIN" && !viewerIsOwner) {
      return <span className="badge badge-gray">{a.ownerOnly}</span>;
    }

    function renderOverflowMenu(items: Array<ReactElement | false | null>) {
      const availableItems = items.filter(Boolean);
      if (!availableItems.length) return null;

      return <RowActionMenu items={availableItems as ReactElement[]} />;
    }

    const actions = ROLE_ACTIONS[user.role_name];
    if (!actions) {
      // Tenant-scoped role. Students and institute instructors are managed in
      // place; the rest just link out to their institute's accounts screen.
      const managed = memberActionBase(user);
      const editPath = memberEditPath(user);
      const link = editPath ?? tenantManageLink(user);
      const resetPath = passwordResetPath(user);
      if (!managed && !link && !resetPath) return <span className="text-muted">—</span>;
      const overflowMenu = renderOverflowMenu([
        Boolean(managed) && (
          <button key="status" type="button" onClick={() => onToggleActive(user)}>
            <Icon name={user.is_active ? "toggleOff" : "toggleOn"} />
            <span>{user.is_active ? a.deactivate : a.reactivate}</span>
          </button>
        ),
        Boolean(resetPath) && (
          <button key="reset" type="button" onClick={() => onResetPassword(user)}>
            <Icon name="lock" />
            <span>{a.resetPassword}</span>
          </button>
        ),
        canDeleteMember(user) && (
          <button key="delete" type="button" className="danger" onClick={() => onRequestDelete(user)}>
            <Icon name="trash" />
            <span>{a.delete}</span>
          </button>
        ),
      ]);

      return (
        <div className="row-actions-inline users-row-actions">
          {link && (
            <Link className="action-btn-icon action-neutral" to={link} data-tooltip={editPath ? a.edit : a.manage}>
              <Icon name="edit" />
            </Link>
          )}
          {overflowMenu}
          {!link && !overflowMenu && (
            <span className="text-muted">—</span>
          )}
        </div>
      );
    }

    return (
      <div className="row-actions-inline users-row-actions">
        <Link className="action-btn-icon action-neutral" to={actions.editPath(user)} data-tooltip={a.edit}>
          <Icon name="edit" />
        </Link>
        {renderOverflowMenu([
          <button key="status" type="button" onClick={() => onToggleActive(user)}>
            <Icon name={user.is_active ? "toggleOff" : "toggleOn"} />
            <span>{user.is_active ? a.deactivate : a.reactivate}</span>
          </button>,
          actions.supportsForceReset && (
            <button key="force-reset" type="button" onClick={() => onForceReset(user)}>
              <Icon name="lock" />
              <span>{user.force_password_reset ? a.clearPasswordReset : a.requirePasswordReset}</span>
            </button>
          ),
          actions.supportsPasswordReset && (
            <button key="reset" type="button" onClick={() => onResetPassword(user)}>
              <Icon name="lock" />
              <span>{a.resetPassword}</span>
            </button>
          ),
          <button key="delete" type="button" className="danger" onClick={() => onRequestDelete(user)}>
            <Icon name="trash" />
            <span>{a.delete}</span>
          </button>,
        ])}
      </div>
    );
  }

  /** Last password change, with who did it on hover. Falls back to the audit
   *  trail's timestamp when the column predates an account's last change. */
  function renderPasswordChanged(user: DirectoryUser) {
    const event = user.last_password_change;
    const changedAt = user.password_changed_at ?? event?.at ?? null;
    if (!changedAt) {
      return <span className="text-muted" data-tooltip={p.neverTooltip}>{p.never}</span>;
    }

    const by = event ? (event.by_self ? p.bySelf : p.byAdmin(event.by_name)) : null;
    const date = formatCompactDate(changedAt);
    return (
      <span className="password-chip" data-tooltip={by ? `Changed ${date} ${by}` : `Changed ${date}`}>
        {formatDaysAgo(changedAt)}
      </span>
    );
  }

  return (
    <DataTableCard className="users-table-wrap">
      <table className="data-table sleek-accounts-table sleek-users-table responsive-data-table">
        <thead>
          <tr>
            {selectable && (
              <th className="table-select-heading col-checkbox">
                <Checkbox
                  aria-label="Select all users"
                  checked={selectedIds.size === selectableRows.length}
                  indeterminate={selectedIds.size > 0 && selectedIds.size < selectableRows.length}
                  onChange={onToggleSelectAll}
                />
              </th>
            )}
            <th className="col-name">{t.name}</th>
            <th className="col-email">{t.email}</th>
            {showInstitute && <th className="col-institute">{t.institute}</th>}
            <th className="col-status">{t.status}</th>
            <th className="col-password">{t.passwordChanged}</th>
            <th className="col-created">{t.created}</th>
            <th className="table-actions-heading col-actions">{t.actions}</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} showInstitute={showInstitute} selectable={selectable} />
            ))
          ) : users.length === 0 ? (
            <tr>
              <td colSpan={(showInstitute ? 7 : 6) + (selectable ? 1 : 0)} className="empty-cell">
                {strings.empty}
              </td>
            </tr>
          ) : (
            users.map((user) => (
              <tr key={`${user.role_name}-${user.id}`} onClick={(e) => handleRowClick(e, user)} className="clickable-row">
                {selectable && (
                  <td className="col-checkbox">
                    <Checkbox
                      aria-label={`Select ${user.first_name} ${user.last_name}`}
                      checked={selectedIds.has(user.id)}
                      disabled={user.is_owner}
                      onChange={() => onToggleSelect(user.id)}
                    />
                  </td>
                )}
                <td className="col-name">
                  <div className="table-item-cell">
                    <TableAvatar
                      src={user.avatar_path ? (user.avatar_path.startsWith('/') ? user.avatar_path : user.avatar_path.startsWith('storage/') ? `/${user.avatar_path}` : `/storage/${user.avatar_path}`) : null}
                      name={`${user.first_name} ${user.last_name}`.trim() || user.email || "Super Admin"}
                      seed={`${user.role_name}-${user.id}-${user.email}`}
                    />
                    <div>
                      <strong className="table-item-title" style={{ fontSize: 13.5 }}>
                        {user.first_name} {user.last_name}
                      </strong>
                      <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                        {currentUserId === user.id && (
                          <span className="badge badge-gray" style={{ fontSize: 10 }}>
                            {b.you}
                          </span>
                        )}
                        {user.is_owner && (
                          <span className="badge badge-red" style={{ fontSize: 10 }}>
                            {b.owner}
                          </span>
                        )}
                        {user.force_password_reset && (
                          <span className="badge badge-amber" style={{ fontSize: 10 }}>
                            {b.passwordReset}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="col-email">{user.email}</td>
                {showInstitute && (
                  <td className="col-institute">
                    {user.institute_id ? (
                      <Link to={`/super-admin/institutes/${user.institute_id}`}>
                        {user.institute_name}
                      </Link>
                    ) : (
                      <span className="text-muted">{strings.platformScope}</span>
                    )}
                  </td>
                )}
                <td className="col-status">
                  <span className={`badge ${user.is_active ? "badge-green" : "badge-inactive"}`}>
                    {user.is_active ? b.active : b.inactive}
                  </span>
                </td>
                <td className="col-password">{renderPasswordChanged(user)}</td>
                <td className="col-created">{formatCompactDate(user.created_at)}</td>
                <td className="table-actions institute-row-actions account-row-actions col-actions">
                  {renderActions(user)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </DataTableCard>
  );
}
