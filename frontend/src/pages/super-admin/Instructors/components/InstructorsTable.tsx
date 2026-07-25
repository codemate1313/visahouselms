import { Link } from "react-router-dom";
import { Icon } from "@/components/icons";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import type { InstructorAccount } from "@/api/types";
import { instructorsStrings as strings } from "../Instructors.strings";

interface InstructorsTableProps {
  instructors: InstructorAccount[];
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  onToggleActive: (instructor: InstructorAccount) => void;
  onResetPassword: (instructor: InstructorAccount) => void;
  onRequestDelete: (instructor: InstructorAccount) => void;
}

export function InstructorsTable({
  instructors,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onToggleActive,
  onResetPassword,
  onRequestDelete,
}: InstructorsTableProps) {
  const t = strings.table;
  return (
    <div className="table-wrap">
      <table className="data-table sleek-institutes-table">
        <thead>
          <tr>
            <th className="table-select-heading">
              <input
                type="checkbox"
                aria-label="Select all instructors"
                checked={instructors.length > 0 && selectedIds.size === instructors.length}
                ref={(el) => {
                  if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < instructors.length;
                }}
                onChange={onToggleSelectAll}
              />
            </th>
            <th>{t.instructor}</th>
            <th>{t.status}</th>
            <th>{t.created}</th>
            <th className="table-actions-heading" style={{ textAlign: "center", width: 140, minWidth: 140 }}>
              {t.actions}
            </th>
          </tr>
        </thead>
        <tbody>
          {instructors.length === 0 ? (
            <tr>
              <td colSpan={5} className="empty-cell">
                {t.empty}
              </td>
            </tr>
          ) : (
            instructors.map((instructor) => (
              <tr key={instructor.id}>
                <td className="table-select-cell">
                  <input
                    type="checkbox"
                    aria-label={`Select ${instructor.first_name} ${instructor.last_name}`}
                    checked={selectedIds.has(instructor.id)}
                    onChange={() => onToggleSelect(instructor.id)}
                  />
                </td>
                <td>
                  <div className="table-item-cell">
                    <div className="table-avatar-tile">{instructor.first_name.charAt(0).toUpperCase()}</div>
                    <div className="table-item-details">
                      <span className="table-item-title" style={{ fontSize: 13.5 }}>
                        {instructor.first_name} {instructor.last_name}
                      </span>
                      <span className="table-item-subtitle" style={{ fontSize: 12, color: "var(--slate-500)" }}>
                        {instructor.title ? `${instructor.title} · ` : ""}
                        {instructor.email}
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span className={`badge ${instructor.is_active ? "badge-green" : "badge-inactive"}`}>
                      {instructor.is_active ? strings.statusFilter.active : strings.statusFilter.inactive}
                    </span>
                    {instructor.force_password_reset && <span className="badge badge-amber">{t.resetRequired}</span>}
                  </div>
                </td>
                <td>{new Date(instructor.created_at).toLocaleDateString("en-GB")}</td>
                <td className="table-actions institute-row-actions">
                  <ToggleSwitch checked={instructor.is_active} onChange={() => onToggleActive(instructor)} tooltip={instructor.is_active ? t.deactivate : t.reactivate} />
                  <Link className="action-btn-icon action-edit" to={`/super-admin/instructors/${instructor.id}`} data-tooltip={t.edit}>
                    <Icon name="edit" />
                  </Link>
                  <button type="button" className="action-btn-icon action-branding" onClick={() => onResetPassword(instructor)} data-tooltip={t.resetPassword}>
                    <Icon name="lock" />
                  </button>
                  <button type="button" className="action-btn-icon danger action-delete" onClick={() => onRequestDelete(instructor)} data-tooltip={t.delete}>
                    <Icon name="trash" />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
