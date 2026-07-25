import { Button } from "@/components/ui";
import { studentOverviewStrings as strings } from "../StudentOverview.strings";

interface StudentCredentialModalProps {
  password: string;
  onClose: () => void;
}

export function StudentCredentialModal({ password, onClose }: StudentCredentialModalProps) {
  const t = strings.credentialModal;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <h2>{t.title}</h2>
        <div className="credential-row">
          <span>{t.passwordLabel}</span>
          <code>{password}</code>
        </div>
        <div className="form-actions">
          <Button onClick={() => navigator.clipboard.writeText(password)}>{t.copyPassword}</Button>
          <Button variant="secondary" type="button" onClick={onClose}>
            {t.done}
          </Button>
        </div>
      </div>
    </div>
  );
}
