import { Link } from "react-router-dom";
import { studentOverviewStrings as strings } from "../StudentOverview.strings";
import type { InstituteMember } from "../types";

interface StudentHeaderProps {
  student: InstituteMember;
  basePath: string;
  canManage: boolean | undefined;
}

export function StudentHeader({ student, basePath, canManage }: StudentHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <span className="page-eyebrow">{strings.eyebrow}</span>
        <h1>{student.first_name} {student.last_name}</h1>
        <p className="page-subtitle">{student.email}</p>
      </div>
      <div className="page-header-actions">
        <Link className="secondary-action link-action" to={basePath}>{strings.back}</Link>
        {!student.deleted_at && canManage && (
          <Link className="secondary-action link-action" to={`${basePath}/${student.id}/edit`}>{strings.edit}</Link>
        )}
      </div>
    </div>
  );
}
