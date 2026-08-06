import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@/components/icons";
import { RowActionMenu } from "@/components/RowActionMenu";
import { TableAvatar } from "@/components/TableAvatar";
import { Badge, Button, Checkbox, DataTableCard, RecordCards } from "@/components/ui";
import { useIsMobile } from "@/hooks/useIsMobile";
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
  basePath?: string;
  /**
   * Developer context. Turns the "Protected" / "Owner Only" badges - the
   * accounts the Super Admin directory refuses to touch - into working
   * Revoke / Restore buttons, because the developer layer sits above them.
   */
  developerActions?: boolean;
  onDeveloperRevoke?: (user: DirectoryUser) => void;
  onDeveloperRestore?: (user: DirectoryUser) => void;
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
  basePath = "/super-admin",
  developerActions = false,
  onDeveloperRevoke,
  onDeveloperRestore,
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
  const isMobile = useIsMobile();
  const selectable = selectableRows.length > 0;
  const t = strings.columns;
  const b = strings.badges;
  const a = strings.actions;
  const p = strings.passwordTrail;

  // In the developer portal, the accounts the Super Admin cannot touch - the
  // owner and other Super Admins - get Revoke / Restore instead of a badge. The
  // buttons call the elevated developer endpoints; the developer's own row
  // still shows a badge, because you cannot revoke yourself.
  function renderElevatedControl(user: DirectoryUser) {
    if (user.id === currentUserId) {
      return <Badge tone="gray">{a.protected}</Badge>;
    }
    return user.is_active ? (
      <Button type="button" variant="danger" size="sm" onClick={() => onDeveloperRevoke?.(user)}>
        Revoke
      </Button>
    ) : (
      <Button type="button" variant="primary" size="sm" onClick={() => onDeveloperRestore?.(user)}>
        Restore
      </Button>
    );
  }

  function renderActions(user: DirectoryUser) {
    if (isProtected(user)) {
      return developerActions ? renderElevatedControl(user) : <Badge tone="gray">{a.protected}</Badge>;
    }

    // Only the owner account may create, edit, deactivate, delete, or reset
    // a Super Admin account from here (self-service goes through "My
    // Profile" instead) - unless this is the developer layer, which sits above
    // Super Admins and can act on them directly.
    if (user.role_name === "SUPER_ADMIN" && !viewerIsOwner) {
      return developerActions ? renderElevatedControl(user) : <Badge tone="gray">{a.ownerOnly}</Badge>;
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
      const editPath = memberEditPath(user, basePath);
      const link = editPath ?? tenantManageLink(user, basePath);
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
        <Link className="action-btn-icon action-neutral" to={actions.editPath(user, basePath)} data-tooltip={a.edit}>
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

  /* On a phone the table is not restyled into cards, it is replaced by them -
     see RecordCards for why. Both branches read the same render helpers, so
     there is one definition of what a status badge or an action menu is. */
  if (isMobile) {
    if (loading) {
      return (
        <div className="record-cards">
          {Array.from({ length: 3 }).map((_, i) => (
            <article className="record-card" key={i}>
              <div className="skeleton-element skeleton-text-title" />
              <div className="skeleton-element skeleton-text-email" />
              <div className="skeleton-element skeleton-badge" />
            </article>
          ))}
        </div>
      );
    }

    return (
      <RecordCards<DirectoryUser>
        rows={users}
        getKey={(user) => `${user.role_name}-${user.id}`}
        empty={strings.empty}
        onRowClick={onInspectUser}
        renderSelect={
          selectable
            ? (user) => (
                <Checkbox
                  aria-label={`Select ${user.first_name} ${user.last_name}`}
                  checked={selectedIds.has(user.id)}
                  disabled={user.is_owner}
                  onChange={() => onToggleSelect(user.id)}
                />
              )
            : undefined
        }
        renderLead={(user) => (
          <>
            <TableAvatar
              src={user.avatar_path ? (user.avatar_path.startsWith("/") ? user.avatar_path : user.avatar_path.startsWith("storage/") ? `/${user.avatar_path}` : `/storage/${user.avatar_path}`) : null}
              name={`${user.first_name} ${user.last_name}`.trim() || user.email || "Super Admin"}
              seed={`${user.role_name}-${user.id}-${user.email}`}
            />
            <span className="record-card-name">
              {user.first_name} {user.last_name}
              <span className="record-card-tags">
                {currentUserId === user.id && <Badge tone="gray">{b.you}</Badge>}
                {user.is_owner && <Badge tone="red">{b.owner}</Badge>}
                {user.force_password_reset && <Badge tone="amber">{b.passwordReset}</Badge>}
              </span>
            </span>
          </>
        )}
        fields={[
          { label: t.email, render: (user) => user.email },
          ...(showInstitute
            ? [
                {
                  label: t.institute,
                  render: (user: DirectoryUser) =>
                    user.institute_id ? (
                      <Link to={`${basePath}/institutes/${user.institute_id}`}>{user.institute_name}</Link>
                    ) : (
                      <span className="text-muted">{strings.platformScope}</span>
                    ),
                },
              ]
            : []),
          {
            label: t.status,
            render: (user) => (
              <Badge tone={user.is_active ? "green" : "inactive"}>
                {user.is_active ? b.active : b.inactive}
              </Badge>
            ),
          },
          { label: t.passwordChanged, render: renderPasswordChanged },
          { label: t.created, render: (user) => formatCompactDate(user.created_at) },
        ]}
        renderActions={renderActions}
      />
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
                <td className="col-name" data-label={t.name}>
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
                          <Badge tone="gray" style={{ fontSize: 10 }}>
                            {b.you}
                          </Badge>
                        )}
                        {user.is_owner && (
                          <Badge tone="red" style={{ fontSize: 10 }}>
                            {b.owner}
                          </Badge>
                        )}
                        {user.force_password_reset && (
                          <Badge tone="amber" style={{ fontSize: 10 }}>
                            {b.passwordReset}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="col-email" data-label={t.email}>{user.email}</td>
                {showInstitute && (
                  <td className="col-institute" data-label={t.institute}>
                    {user.institute_id ? (
                      <Link to={`${basePath}/institutes/${user.institute_id}`}>
                        {user.institute_name}
                      </Link>
                    ) : (
                      <span className="text-muted">{strings.platformScope}</span>
                    )}
                  </td>
                )}
                <td className="col-status" data-label={t.status}>
                  <Badge tone={user.is_active ? "green" : "inactive"}>
                    {user.is_active ? b.active : b.inactive}
                  </Badge>
                </td>
                <td className="col-password" data-label={t.passwordChanged}>{renderPasswordChanged(user)}</td>
                <td className="col-created" data-label={t.created}>{formatCompactDate(user.created_at)}</td>
                <td className="table-actions institute-row-actions account-row-actions col-actions" data-label={t.actions}>
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
