import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { RequiredMark } from "@/components/ui";
import { accountFormStrings as strings } from "../AccountForm.strings";

interface PersonalDetailsPanelProps {
  firstName: string;
  onFirstNameChange: (value: string) => void;
  lastName: string;
  onLastNameChange: (value: string) => void;
  email: string;
  onEmailChange: (value: string) => void;
}

export function PersonalDetailsPanel({ firstName, onFirstNameChange, lastName, onLastNameChange, email, onEmailChange }: PersonalDetailsPanelProps) {
  const t = strings.personalDetails;
  return (
    <CollapsiblePanel className="account-form-section" title={t.title} description={t.description}>
      <div className="account-field-grid">
        <div>
          <label htmlFor="first_name">{t.firstName}<RequiredMark /></label>
          <input id="first_name" value={firstName} onChange={(event) => onFirstNameChange(event.target.value)} required />
        </div>

        <div>
          <label htmlFor="last_name">{t.lastName}<RequiredMark /></label>
          <input id="last_name" value={lastName} onChange={(event) => onLastNameChange(event.target.value)} required />
        </div>

        <div className="field-wide">
          <label htmlFor="email">{t.email}<RequiredMark /></label>
          <input id="email" type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} required />
        </div>
      </div>
    </CollapsiblePanel>
  );
}
