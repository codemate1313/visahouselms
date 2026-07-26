import { Link } from "react-router-dom";
import { API_BASE_URL } from "@/api/client";
import { Icon } from "@/components/icons";
import { TableAvatar } from "@/components/TableAvatar";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { Checkbox } from "@/components/ui";
import type { DirectoryUser } from "@/api/types";
import { usersStrings as strings } from "../Users.strings";
import { ROLE_ACTIONS, isProtected, tenantManageLink } from "../userActions";

interface UsersTableProps {
  users: DirectoryUser[];
  currentUserId: number | undefined;
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
}

export function UsersTable({
  users,
  currentUserId,
  showInstitute,
  onToggleActive,
  onForceReset,
  onResetPassword,
  onRequestDelete,
  selectableRows,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: UsersTableProps) {
  const selectable = selectableRows.length > 0;
  const t = strings.columns;
  const b = strings.badges;
  const a = strings.actions;

  function renderActions(user: DirectoryUser) {
    if (isProtected(user)) {
      return <span className="badge badge-gray">{a.protected}</span>;
    }

    const actions = ROLE_ACTIONS[user.role_name];
    if (!actions) {
      // Tenant-scoped role: hand off to the institute's own accounts screen.
      const link = tenantManageLink(user);
      return link ? (
        <Link className="action-btn-icon action-edit" to={link} data-tooltip={a.manage}>
          <Icon name="edit" />
        </Link>
      ) : (
        <span className="text-muted">—</span>
      );
    }

    return (
      <div className="row-actions-inline">
        <ToggleSwitch
          checked={user.is_active}
          onChange={() => onToggleActive(user)}
          tooltip={user.is_active ? a.deactivate : a.reactivate}
        />
        <Link className="action-btn-icon action-edit" to={actions.editPath(user)} data-tooltip={a.edit}>
          <Icon name="edit" />
        </Link>
        {actions.supportsForceReset && (
          <button
            type="button"
            className="action-btn-icon action-branding"
            onClick={() => onForceReset(user)}
            data-tooltip={user.force_password_reset ? a.clearPasswordReset : a.requirePasswordReset}
          >
            <Icon name="lock" />
          </button>
        )}
        {actions.supportsPasswordReset && (
          <button
            type="button"
            className="action-btn-icon action-branding"
            onClick={() => onResetPassword(user)}
            data-tooltip={a.resetPassword}
          >
            <Icon name="lock" />
          </button>
        )}
        <button
          type="button"
          className="action-btn-icon danger action-delete"
          onClick={() => onRequestDelete(user)}
          data-tooltip={a.delete}
        >
          <Icon name="trash" />
        </button>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="data-table sleek-accounts-table">
        <thead>
          <tr>
            {selectable && (
              <th className="table-select-heading">
                <Checkbox
                  aria-label="Select all users"
                  checked={selectedIds.size === selectableRows.length}
                  indeterminate={selectedIds.size > 0 && selectedIds.size < selectableRows.length}
                  onChange={onToggleSelectAll}
                />
              </th>
            )}
            <th>{t.name}</th>
            <th>{t.email}</th>
            {showInstitute && <th>{t.institute}</th>}
            <th>{t.status}</th>
            <th>{t.created}</th>
            <th className="table-actions-heading">{t.actions}</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 && (
            <tr>
              <td colSpan={(showInstitute ? 6 : 5) + (selectable ? 1 : 0)} className="empty-cell">
                {strings.empty}
              </td>
            </tr>
          )}
          {users.map((user) => (
            <tr key={`${user.role_name}-${user.id}`}>
              {selectable && (
                <td>
                  <Checkbox
                    aria-label={`Select ${user.first_name} ${user.last_name}`}
                    checked={selectedIds.has(user.id)}
                    disabled={user.is_owner}
                    onChange={() => onToggleSelect(user.id)}
                  />
                </td>
              )}
              <td>
                <div className="table-item-cell">
                  <TableAvatar
                    src={user.avatar_path ? `${API_BASE_URL}/storage/${user.avatar_path}` : null}
                    name={user.first_name}
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
              <td>{user.email}</td>
              {showInstitute && (
                <td>
                  {user.institute_id ? (
                    <Link to={`/super-admin/institutes/${user.institute_id}`}>
                      {user.institute_name}
                    </Link>
                  ) : (
                    <span className="text-muted">{strings.platformScope}</span>
                  )}
                </td>
              )}
              <td>
                <span className={`badge ${user.is_active ? "badge-green" : "badge-inactive"}`}>
                  {user.is_active ? b.active : b.inactive}
                </span>
              </td>
              <td>{new Date(user.created_at).toLocaleDateString("en-GB")}</td>
              <td className="table-actions institute-row-actions account-row-actions">
                {renderActions(user)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
