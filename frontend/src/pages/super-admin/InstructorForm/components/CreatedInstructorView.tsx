import type { InstructorAccountCreated } from "@/api/types";
import { Button } from "@/components/ui";
import { instructorFormStrings as strings } from "../InstructorForm.strings";
import { extractTemporaryPassword } from "../helpers";

interface CreatedInstructorViewProps {
  created: InstructorAccountCreated;
  copied: boolean;
  error: string | null;
  onCopyPassword: () => void;
  onDone: () => void;
}

export function CreatedInstructorView({ created, copied, error, onCopyPassword, onDone }: CreatedInstructorViewProps) {
  const t = strings.created;
  const createdPassword = extractTemporaryPassword(created);
  return (
    <div>
      <h1>{t.heading}</h1>
      <div className="credential-card standalone">
        <div>
          <strong>{t.credentialsLabel}</strong>
          <p>{created.email}</p>
          {createdPassword ? <code>{createdPassword}</code> : <p className="error-text">{t.missingPassword}</p>}
          <p className="hint">{t.shareHint}</p>
          {error && <p className="error-text">{error}</p>}
        </div>
        <div className="credential-actions">
          <Button variant="secondary" className="secondary-button" onClick={onCopyPassword}>
            {copied ? t.copied : t.copyPassword}
          </Button>
          <Button variant="secondary" className="secondary-button" onClick={onDone}>
            {t.done}
          </Button>
        </div>
      </div>
    </div>
  );
}
