import { Icon } from "@/components/icons";
import type { Course } from "@/api/types";
import { courseAssignmentsStrings as strings } from "../CourseAssignments.strings";

interface AccessHistoryTableProps {
  assignments: Course["assignments"];
  onUnassign: (instituteId: number) => void;
}

export function AccessHistoryTable({ assignments, onUnassign }: AccessHistoryTableProps) {
  const t = strings.history;
  return (
    <>
      <h2 className="section-title">{t.heading}</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>{t.institute}</th>
            <th>{t.assigned}</th>
            <th>{t.status}</th>
            <th className="table-actions-heading">{t.actions}</th>
          </tr>
        </thead>
        <tbody>
          {!assignments?.length ? (
            <tr>
              <td colSpan={4} className="empty-cell">
                {t.empty}
              </td>
            </tr>
          ) : (
            assignments.map((item) => (
              <tr key={item.id}>
                <td>{item.institute_name}</td>
                <td>{new Date(item.assigned_at).toLocaleDateString()}</td>
                <td>
                  <span className={`badge ${item.is_active ? "badge-green" : "badge-gray"}`}>{item.is_active ? t.active : t.revoked}</span>
                </td>
                <td className="table-actions">
                  {item.is_active && (
                    <button className="danger" onClick={() => onUnassign(item.institute_id)} aria-label={t.revokeAccess} data-tooltip={t.revokeAccess}>
                      <Icon name="revoke" />
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </>
  );
}
