import { Button } from "@/components/ui";
import { instituteMembersStrings as strings } from "../InstituteMembers.strings";

interface CredentialModalProps {
  credential: { name: string; password: string };
  onClose: () => void;
}

export function CredentialModal({ credential, onClose }: CredentialModalProps) {
  const t = strings.credentialModal;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <h2>{t.title}</h2>
        <p className="hint">{t.shareHint(credential.name)}</p>
        <div className="credential-row">
          <span>{t.passwordLabel}</span>
          <code>{credential.password}</code>
        </div>
        <div className="form-actions">
          <Button onClick={() => navigator.clipboard.writeText(credential.password)}>{t.copyPassword}</Button>
          <Button variant="secondary" type="button" onClick={onClose}>
            {t.done}
          </Button>
        </div>
      </div>
    </div>
  );
}
