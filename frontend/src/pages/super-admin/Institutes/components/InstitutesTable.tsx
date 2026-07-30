import { Link } from "react-router-dom";
import { API_BASE_URL } from "@/api/client";
import { Icon } from "@/components/icons";
import { RowActionMenu } from "@/components/RowActionMenu";
import { TableAvatar } from "@/components/TableAvatar";
import { institutesStrings as strings } from "../Institutes.strings";
import type { InstituteRow, SortKey } from "../types";
import {
  INSTITUTE_STATUS,
  INSTITUTE_STATUS_LABELS,
  SUBSCRIPTION_STATE_BADGES,
  SUBSCRIPTION_STATUS_LABELS,
  type SubscriptionStatus,
} from "@/constants";

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
            <th className="table-actions-heading" style={{ textAlign: "right", paddingRight: 12 }}>
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
                  <TableAvatar
                    src={row.logo_url ? `${API_BASE_URL}${row.logo_url}` : null}
                    name={row.name}
                    alt={`${row.name} logo`}
                  />
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
                <span className={`badge ${SUBSCRIPTION_STATE_BADGES[row.subscription_state] ?? "badge-gray"}`}>
                  {SUBSCRIPTION_STATUS_LABELS[row.subscription_state as SubscriptionStatus] ?? row.subscription_state}
                </span>
              </td>
              <td>
                <span className={`badge ${row.is_active ? "badge-green" : "badge-gray"}`}>
                  {row.onboarding_status === INSTITUTE_STATUS.DRAFT
                    ? INSTITUTE_STATUS_LABELS.draft
                    : row.is_active
                      ? INSTITUTE_STATUS_LABELS.active
                      : INSTITUTE_STATUS_LABELS.suspended}
                </span>
              </td>
              <td className="table-actions institute-row-actions" style={{ paddingRight: 12 }}>
                <RowActionMenu
                  items={[
                    <button key="status" type="button" onClick={() => onToggleActive(row)}>
                      <Icon name={row.is_active ? "toggleOff" : "toggleOn"} />
                      <span>{row.is_active ? t.suspendInstitute : t.reactivateInstitute}</span>
                    </button>,
                    <Link key="edit" to={`/super-admin/institutes/${row.id}`}>
                      <Icon name="edit" />
                      <span>{t.editInstitute}</span>
                    </Link>,
                    <Link key="students" to={`/super-admin/institutes/${row.id}/students`}>
                      <Icon name="user" />
                      <span>{t.manageStudents}</span>
                    </Link>,
                    <Link key="branding" to={`/super-admin/institutes/${row.id}/branding`}>
                      <Icon name="settings" />
                      <span>{t.branding}</span>
                    </Link>,
                    <button key="delete" type="button" className="danger" onClick={() => onRequestDelete(row)}>
                      <Icon name="trash" />
                      <span>{t.delete}</span>
                    </button>,
                  ]}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
