import { Button, LinkButton, PageHeader } from "@/components/ui";
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
    <PageHeader
      eyebrow={strings.eyebrow}
      title={label}
      subtitle={strings.subtitle}
      actions={
        <>
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
          <LinkButton to={`${basePath}/students/new`}>
            {strings.addStudent}
          </LinkButton>
        )}
        {isSuperAdmin && canAddStaff && (
          <LinkButton variant="secondary" to={`${basePath}/staff/new`}>
            {strings.addInstructor}
          </LinkButton>
        )}
        {!isSuperAdmin && isStudent && canManage && canAddStudents && (
          <LinkButton to={`${basePath}/new`}>
            {strings.addStudent}
          </LinkButton>
        )}
        {!isSuperAdmin && !isStudent && canManage && canAddStaff && (
          <LinkButton to={`${basePath}/new`}>
            {strings.addInstructor}
          </LinkButton>
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
        </>
      }
    />
  );
}
