import type { FormEvent } from "react";
import { PasswordInput } from "@/components/PasswordInput";
import { Button, RequiredMark } from "@/components/ui";
import { terminalStrings as strings } from "../Terminal.strings";

interface TerminalAuthGateProps {
  password: string;
  onPasswordChange: (value: string) => void;
  error: string | null;
  connecting: boolean;
  onConnect: (event: FormEvent) => void;
}

export function TerminalAuthGate({ password, onPasswordChange, error, connecting, onConnect }: TerminalAuthGateProps) {
  const t = strings.authGate;
  return (
    <div>
      <h1>{strings.title}</h1>
      <form className="form-card" onSubmit={onConnect}>
        <p className="hint">{t.hint}</p>
        <label htmlFor="terminal_password">{t.passwordLabel}<RequiredMark /></label>
        <PasswordInput id="terminal_password" value={password} onChange={(e) => onPasswordChange(e.target.value)} required />
        {error && <p className="error-text">{error}</p>}
        <div className="form-actions">
          <Button type="submit" disabled={connecting || !password}>
            {connecting ? t.opening : t.openTerminal}
          </Button>
        </div>
      </form>
    </div>
  );
}
