import { Link } from "react-router-dom";
import { API_BASE_URL } from "@/api/client";
import { Icon } from "@/components/icons";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { institutesStrings as strings } from "../Institutes.strings";
import type { InstituteRow, SortKey } from "../types";

const STATE_BADGES: Record<string, string> = {
  active: "badge-green",
  grace: "badge-amber",
  expired: "badge-red",
  none: "badge-gray",
};

interface InstitutesTableProps {
  rows: InstituteRow[];
  sortKey: SortKey;
  sortDirection: "ascending" | "descending";
  onChangeSort: (key: SortKey) => void;
  onToggleActive: (row: InstituteRow) => void;
  onRequestDelete: (row: InstituteRow) => void;
}

export function InstitutesTable({ rows, sortKey, sortDirection, onChangeSort, onToggleActive, onRequestDelete }: InstitutesTableProps) {
  const t = strings.table;
  return (
    <div className="table-wrap">
      <table className="data-table sleek-institutes-table">
        <thead>
          <tr>
            <th aria-sort={sortKey === "name" ? sortDirection : "none"}>
              <button type="button" className="table-sort-button" onClick={() => onChangeSort("name")}>
                {t.institute}
              </button>
            </th>
            <th aria-sort={sortKey === "slug" ? sortDirection : "none"}>
              <button type="button" className="table-sort-button" onClick={() => onChangeSort("slug")}>
                {t.contactAndSlug}
              </button>
            </th>
            <th>{t.subscription}</th>
            <th>{t.status}</th>
            <th className="table-actions-heading" style={{ textAlign: "right", paddingRight: 24 }}>
              {t.actions}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="empty-cell">
                {t.empty}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <div className="table-item-cell">
                  <div className="table-avatar-tile">
                    {row.logo_url ? <img src={`${API_BASE_URL}${row.logo_url}`} alt={`${row.name} logo`} /> : row.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="table-item-details">
                    <span className="table-item-title">{row.name}</span>
                    <span className="table-item-subtitle">
                      {t.idPrefix}
                      {row.id}
                    </span>
                  </div>
                </div>
              </td>
              <td>
                <div className="table-item-details">
                  <span className="table-item-title" style={{ fontSize: 13, fontWeight: 500 }}>
                    {row.contact_email ?? "—"}
                  </span>
                  <span className="table-item-subtitle" style={{ fontSize: 11.5, color: "var(--slate-400)" }}>
                    {t.slugPrefix} {row.slug}
                  </span>
                </div>
              </td>
              <td>
                <span className={`badge ${STATE_BADGES[row.subscription_state] ?? "badge-gray"}`}>{row.subscription_state}</span>
              </td>
              <td>
                <span className={`badge ${row.is_active ? "badge-green" : "badge-gray"}`}>
                  {row.onboarding_status === "draft" ? strings.statusFilter.draft : row.is_active ? strings.statusFilter.active : strings.statusFilter.suspended}
                </span>
              </td>
              <td className="table-actions institute-row-actions" style={{ paddingRight: 24 }}>
                <ToggleSwitch checked={row.is_active} onChange={() => onToggleActive(row)} tooltip={row.is_active ? t.suspendInstitute : t.reactivateInstitute} />
                <Link className="action-btn-icon action-edit" to={`/super-admin/institutes/${row.id}`} data-tooltip={t.editInstitute}>
                  <Icon name="edit" />
                </Link>
                <Link className="action-btn-icon action-students" to={`/super-admin/institutes/${row.id}/students`} data-tooltip={t.manageStudents}>
                  <Icon name="user" />
                </Link>
                <Link className="action-btn-icon action-branding" to={`/super-admin/institutes/${row.id}/branding`} data-tooltip={t.branding}>
                  <Icon name="settings" />
                </Link>
                <button className="action-btn-icon danger action-delete" onClick={() => onRequestDelete(row)} data-tooltip={t.delete}>
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
