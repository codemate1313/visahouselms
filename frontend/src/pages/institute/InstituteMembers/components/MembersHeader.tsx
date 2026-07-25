import { Link } from "react-router-dom";
import { Button } from "@/components/ui";
import { instituteMembersStrings as strings } from "../InstituteMembers.strings";

interface MembersHeaderProps {
  label: string;
  canProvision: boolean;
  isSuperAdmin: boolean;
  isStudent: boolean;
  canManage: boolean | undefined;
  canAddStudents: boolean;
  canAddStaff: boolean;
  basePath: string;
  onDownloadTemplate: () => void;
  onImportClick: () => void;
  onImportFile: (file: File) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function MembersHeader({
  label,
  canProvision,
  isSuperAdmin,
  isStudent,
  canManage,
  canAddStudents,
  canAddStaff,
  basePath,
  onDownloadTemplate,
  onImportClick,
  onImportFile,
  fileInputRef,
}: MembersHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <span className="page-eyebrow">{strings.eyebrow}</span>
        <h1>{label}</h1>
        <p className="page-subtitle">{strings.subtitle}</p>
      </div>
      <div className="page-header-actions">
        {canProvision && (
          <Button variant="secondary" size="sm" onClick={onDownloadTemplate}>
            {strings.downloadTemplate}
          </Button>
        )}
        {canProvision && (
          <Button variant="secondary" size="sm" onClick={onImportClick}>
            {strings.importCsvExcel}
          </Button>
        )}
        {isSuperAdmin && canAddStudents && (
          <Link className="button-link" to={`${basePath}/students/new`}>
            {strings.addStudent}
          </Link>
        )}
        {isSuperAdmin && canAddStaff && (
          <Link className="button-link secondary-button" to={`${basePath}/staff/new`}>
            {strings.addInstructor}
          </Link>
        )}
        {!isSuperAdmin && isStudent && canManage && canAddStudents && (
          <Link className="button-link" to={`${basePath}/new`}>
            {strings.addStudent}
          </Link>
        )}
        {!isSuperAdmin && !isStudent && canManage && canAddStaff && (
          <Link className="button-link" to={`${basePath}/new`}>
            {strings.addInstructor}
          </Link>
        )}
        {canProvision && (
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept=".csv,.xlsx"
            onChange={(event) => event.target.files?.[0] && onImportFile(event.target.files[0])}
          />
        )}
      </div>
    </div>
  );
}
