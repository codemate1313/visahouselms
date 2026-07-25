import { Link } from "react-router-dom";
import { API_BASE_URL } from "@/api/client";
import { Icon } from "@/components/icons";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import type { SuperAdminAccount } from "@/api/types";
import { accountsListStrings as strings } from "../AccountsList.strings";

interface AccountsTableProps {
  accounts: SuperAdminAccount[];
  currentUserId: number | undefined;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  onToggleActive: (account: SuperAdminAccount) => void;
  onForceReset: (account: SuperAdminAccount) => void;
  onRequestDelete: (account: SuperAdminAccount) => void;
}

export function AccountsTable({
  accounts,
  currentUserId,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onToggleActive,
  onForceReset,
  onRequestDelete,
}: AccountsTableProps) {
  const t = strings.table;
  return (
    <div className="table-wrap">
      <table className="data-table sleek-accounts-table">
        <thead>
          <tr>
            <th className="table-select-heading">
              <input
                type="checkbox"
                aria-label="Select all accounts"
                checked={accounts.length > 0 && selectedIds.size === accounts.length}
                ref={(el) => {
                  if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < accounts.length;
                }}
                onChange={onToggleSelectAll}
              />
            </th>
            <th>{t.name}</th>
            <th>{t.email}</th>
            <th>{t.status}</th>
            <th>{t.created}</th>
            <th className="table-actions-heading">{t.actions}</th>
          </tr>
        </thead>
        <tbody>
          {accounts.length === 0 && (
            <tr>
              <td colSpan={6} className="empty-cell">
                {t.empty}
              </td>
            </tr>
          )}
          {accounts.map((account) => (
            <tr key={account.id}>
              <td className="table-select-cell">
                <input
                  type="checkbox"
                  aria-label={`Select ${account.first_name} ${account.last_name}`}
                  checked={selectedIds.has(account.id)}
                  onChange={() => onToggleSelect(account.id)}
                />
              </td>
              <td>
                <div className="table-item-cell">
                  <div className="table-avatar-tile">
                    {account.avatar_path ? (
                      <img src={`${API_BASE_URL}/storage/${account.avatar_path}`} alt="" />
                    ) : (
                      account.first_name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <strong className="table-item-title" style={{ fontSize: 13.5 }}>
                      {account.first_name} {account.last_name}
                    </strong>
                    <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                      {currentUserId === account.id && (
                        <span className="badge badge-gray" style={{ fontSize: 10 }}>
                          {t.you}
                        </span>
                      )}
                      {account.force_password_reset && (
                        <span className="badge badge-amber" style={{ fontSize: 10 }}>
                          {t.resetRequired}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </td>
              <td>{account.email}</td>
              <td>
                <span className={`badge ${account.is_active ? "badge-green" : "badge-inactive"}`}>
                  {account.is_active ? strings.statusFilter.active : strings.statusFilter.inactive}
                </span>
              </td>
              <td>{new Date(account.created_at).toLocaleDateString("en-GB")}</td>
              <td className="table-actions institute-row-actions">
                <ToggleSwitch
                  checked={account.is_active}
                  onChange={() => onToggleActive(account)}
                  tooltip={account.is_active ? t.deactivate : t.reactivate}
                />
                <Link className="action-btn-icon action-edit" to={`/super-admin/accounts/${account.id}`} data-tooltip={t.edit}>
                  <Icon name="edit" />
                </Link>
                <button
                  type="button"
                  className="action-btn-icon action-branding"
                  onClick={() => onForceReset(account)}
                  data-tooltip={account.force_password_reset ? t.clearPasswordReset : t.requirePasswordReset}
                >
                  <Icon name="lock" />
                </button>
                <button
                  type="button"
                  className="action-btn-icon danger action-delete"
                  onClick={() => onRequestDelete(account)}
                  data-tooltip={t.delete}
                >
                  <Icon name="trash" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
