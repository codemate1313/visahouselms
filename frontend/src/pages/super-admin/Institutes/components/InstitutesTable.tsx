import { Link } from "react-router-dom";
import { API_BASE_URL } from "@/api/client";
import { Icon } from "@/components/icons";
import { RowActionMenu } from "@/components/RowActionMenu";
import { TableAvatar } from "@/components/TableAvatar";
import { Badge, Checkbox, DataTableCard } from "@/components/ui";
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
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  onRowClick: (id: number) => void;
}

export function InstitutesTable({
  rows,
  sortKey,
  sortDirection,
  onChangeSort,
  onToggleActive,
  onRequestDelete,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onRowClick,
}: InstitutesTableProps) {
  const t = strings.table;
  const hasRows = rows.length > 0;
  const allSelected = hasRows && selectedIds.size === rows.length;
  const partiallySelected = selectedIds.size > 0 && selectedIds.size < rows.length;

  return (
    <DataTableCard>
      <table className="data-table sleek-institutes-table institutes-directory-table responsive-data-table">
        <thead>
          <tr>
            <th className="table-select-heading col-checkbox">
              <Checkbox
                aria-label={t.selectAll}
                checked={allSelected}
                disabled={!hasRows}
                indeterminate={partiallySelected}
                onChange={onToggleSelectAll}
              />
            </th>
            <th className="col-institute" aria-sort={sortKey === "name" ? sortDirection : "none"}>
              <button type="button" className="table-sort-button" onClick={() => onChangeSort("name")}>
                {t.institute}
              </button>
            </th>
            <th className="col-contact" aria-sort={sortKey === "slug" ? sortDirection : "none"}>
              <button type="button" className="table-sort-button" onClick={() => onChangeSort("slug")}>
                {t.contactAndSlug}
              </button>
            </th>
            <th className="col-subscription">{t.subscription}</th>
            <th className="col-status">{t.status}</th>
            <th className="table-actions-heading col-actions">
              {t.actions}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="empty-cell">
                {t.empty}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr
              className={selectedIds.has(row.id) ? "is-selected-row" : ""}
              key={row.id}
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (
                  target.closest("a") ||
                  target.closest("button") ||
                  target.closest("input") ||
                  target.closest(".col-checkbox") ||
                  target.closest(".col-actions")
                ) {
                  return;
                }
                onRowClick(row.id);
              }}
              style={{ cursor: "pointer" }}
            >
              <td className="col-checkbox">
                <Checkbox
                  aria-label={t.selectInstitute(row.name)}
                  checked={selectedIds.has(row.id)}
                  onChange={() => onToggleSelect(row.id)}
                />
              </td>
              <td className="col-institute" data-label={t.institute}>
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
              <td className="col-contact" data-label={t.contactAndSlug}>
                <div className="table-item-details">
                  <span className="table-item-title" style={{ fontSize: 13, fontWeight: 500 }}>
                    {row.contact_email ?? "—"}
                  </span>
                  <span className="table-item-subtitle" style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                    {t.slugPrefix} {row.slug}
                  </span>
                </div>
              </td>
              <td className="col-subscription" data-label={t.subscription}>
                <Badge tone={SUBSCRIPTION_STATE_BADGES[row.subscription_state] ?? "gray"}>
                  {SUBSCRIPTION_STATUS_LABELS[row.subscription_state as SubscriptionStatus] ?? row.subscription_state}
                </Badge>
              </td>
              <td className="col-status" data-label={t.status}>
                <Badge tone={row.is_active ? "green" : "gray"}>
                  {row.onboarding_status === INSTITUTE_STATUS.DRAFT
                    ? INSTITUTE_STATUS_LABELS.draft
                    : row.is_active
                      ? INSTITUTE_STATUS_LABELS.active
                      : INSTITUTE_STATUS_LABELS.suspended}
                </Badge>
              </td>
              <td className="table-actions institute-row-actions col-actions" data-label={t.actions}>
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
    </DataTableCard>
  );
}
