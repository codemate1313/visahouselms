import { instituteMemberFormStrings as strings } from "../InstituteMemberForm.strings";
import { Button } from "@/components/ui/Button/Button";

interface CredentialCreatedViewProps {
  isStudent: boolean;
  email: string;
  password: string;
  onDone: () => void;
}

export function CredentialCreatedView({ isStudent, email, password, onDone }: CredentialCreatedViewProps) {
  const t = strings.credential;
  return (
    <div>
      <h1>{strings.createdTitle(isStudent)}</h1>
      <section className="workspace-panel credential-panel">
        <p>{t.shareHint}</p>
        <div className="credential-row"><span>{t.emailLabel}</span><code>{email}</code></div>
        <div className="credential-row"><span>{t.passwordLabel}</span><code>{password}</code></div>
        <div className="form-actions">
          <Button variant="secondary" onClick={() => navigator.clipboard.writeText(password)}>{strings.actions.copyPassword}</Button>
          <Button type="button" onClick={onDone}>{strings.actions.done}</Button>
        </div>
      </section>
    </div>
  );
}
