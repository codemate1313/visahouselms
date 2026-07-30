import { Link } from "react-router-dom";
import { PageHeader } from "@/components/ui";
import { studentOverviewStrings as strings } from "../StudentOverview.strings";
import type { InstituteMember } from "../types";

interface StudentHeaderProps {
  student: InstituteMember;
  basePath: string;
  canManage: boolean | undefined;
}

export function StudentHeader({ student, basePath, canManage }: StudentHeaderProps) {
  return (
    <PageHeader
      eyebrow={strings.eyebrow}
      title={`${student.first_name} ${student.last_name}`}
      subtitle={student.email}
      actions={
        <>
          <Link className="secondary-action link-action" to={basePath}>{strings.back}</Link>
          {!student.deleted_at && canManage && (
            <Link className="secondary-action link-action" to={`${basePath}/${student.id}/edit`}>{strings.edit}</Link>
          )}
        </>
      }
    />
  );
}
