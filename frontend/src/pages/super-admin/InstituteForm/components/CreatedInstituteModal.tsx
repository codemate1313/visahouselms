import { instituteFormStrings as strings } from "../InstituteForm.strings";
import type { CreatedInstitute } from "../types";

interface CreatedInstituteModalProps {
  created: CreatedInstitute;
  copied: boolean;
  onCopyPassword: () => void;
  onAddStudents: () => void;
  onDone: () => void;
}

export function CreatedInstituteModal({ created, copied, onCopyPassword, onAddStudents, onDone }: CreatedInstituteModalProps) {
  const t = strings.createdModal;
  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h2>{t.heading}</h2>
        <p className="hint">{t.description}</p>
        <div className="credential-row">
          <span>{t.email}</span>
          <code>{created.admin_email}</code>
        </div>
        <div className="credential-row">
          <span>{t.temporaryPassword}</span>
          <code>{created.admin_temp_password}</code>
        </div>
        <div className="form-actions">
          <button type="button" onClick={onCopyPassword}>
            {copied ? t.copied : t.copyPassword}
          </button>
          <button type="button" onClick={onAddStudents}>
            {t.addStudents}
          </button>
          <button type="button" onClick={onDone}>
            {t.done}
          </button>
        </div>
      </div>
    </div>
  );
}
