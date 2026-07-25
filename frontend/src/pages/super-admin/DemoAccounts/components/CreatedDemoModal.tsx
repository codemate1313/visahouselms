import { demoAccountsStrings as strings } from "../DemoAccounts.strings";
import type { CreatedDemo } from "../types";

interface CreatedDemoModalProps {
  created: CreatedDemo;
  copied: boolean;
  onCopyPassword: () => void;
  onDone: () => void;
}

export function CreatedDemoModal({ created, copied, onCopyPassword, onDone }: CreatedDemoModalProps) {
  const t = strings.createdModal;
  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h2>{t.title}</h2>
        <p className="hint">{t.hint}</p>
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
          <button type="button" onClick={onDone}>
            {t.done}
          </button>
        </div>
      </div>
    </div>
  );
}
