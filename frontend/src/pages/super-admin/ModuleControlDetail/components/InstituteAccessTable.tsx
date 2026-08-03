import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { Icon } from "@/components/icons";
import { moduleControlDetailStrings as strings } from "../ModuleControlDetail.strings";
import { formatDate } from "../helpers";
import type { Assignment } from "../types";

interface InstituteAccessTableProps {
  assignments: Assignment[];
  onRevoke: (instituteId: number, instituteName: string) => void;
}

export function InstituteAccessTable({ assignments, onRevoke }: InstituteAccessTableProps) {
  const t = strings.accessTable;
  const activeAssignments = assignments.filter((a) => a.is_active);
  return (
    <CollapsiblePanel
      className="detail-card access-table-panel"
      title={t.title}
      description={t.description}
      badge={<span className="count-chip">{activeAssignments.length}</span>}
    >
      <div className="table-responsive-wrapper">
        <table className="data-table sleek-access-table">
          <thead>
            <tr>
              <th>{t.institute}</th>
              <th>{t.assigned}</th>
              <th>{t.status}</th>
              <th style={{ textTransform: "none" }} />
            </tr>
          </thead>
          <tbody>
            {!activeAssignments.length ? (
              <tr>
                <td colSpan={4} className="empty-cell">
                  {t.empty}
                </td>
              </tr>
            ) : (
              activeAssignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td>
                    <strong>{assignment.institute_name}</strong>
                  </td>
                  <td>{formatDate(assignment.assigned_at)}</td>
                  <td>
                    <span className={`badge ${assignment.is_active ? "badge-green" : "badge-gray"}`}>
                      {assignment.is_active ? t.active : t.revoked}
                    </span>
                  </td>
                  <td className="table-actions">
                    {assignment.is_active && (
                      <button
                        type="button"
                        className="danger"
                        onClick={() => onRevoke(assignment.institute_id, assignment.institute_name)}
                        aria-label={t.revokeAccess}
                        data-tooltip={t.revokeAccess}
                      >
                        <Icon name="revoke" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </CollapsiblePanel>
  );
}
