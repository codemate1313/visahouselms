import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { PasswordInput } from "@/components/PasswordInput";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";
import { RequiredMark } from "@/components/ui";
import { accountFormStrings as strings } from "../AccountForm.strings";

interface SecurityPanelProps {
  password: string;
  onPasswordChange: (value: string) => void;
}

export function SecurityPanel({ password, onPasswordChange }: SecurityPanelProps) {
  const t = strings.security;
  return (
    <CollapsiblePanel className="account-form-section" title={t.title} description={t.description}>
      <label htmlFor="password">{t.password}<RequiredMark /></label>
      <PasswordInput id="password" value={password} onChange={(event) => onPasswordChange(event.target.value)} required />
      <PasswordStrengthMeter password={password} />
    </CollapsiblePanel>
  );
}
