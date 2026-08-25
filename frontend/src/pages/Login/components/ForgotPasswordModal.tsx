import type { FormEvent } from "react";
import { Icon } from "@/components/icons";
import { Button, Modal, RequiredMark } from "@/components/ui";
import { loginStrings as strings } from "../Login.strings";

interface ForgotPasswordModalProps {
  email: string;
  onEmailChange: (value: string) => void;
  sent: boolean;
  loading: boolean;
  error: string | null;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
  onDone: () => void;
}

export function ForgotPasswordModal({
  email,
  onEmailChange,
  sent,
  loading,
  error,
  onSubmit,
  onClose,
  onDone,
}: ForgotPasswordModalProps) {
  const t = strings.forgotModal;

  return (
    <Modal
      open
      onClose={onClose}
      title={sent ? "Email Sent" : t.title}
      size="sm"
      actions={
        sent ? (
          <Button type="button" fullWidth onClick={onDone}>
            {t.doneLabel}
          </Button>
        ) : (
          <Button type="submit" form="forgot-password-form" fullWidth loading={loading} disabled={!email}>
            {loading ? t.sendBusy : t.sendLabel}
          </Button>
        )
      }
    >
      {sent ? (
        <div className="forgot-password-state is-success">
          <span className="forgot-password-icon" aria-hidden="true">
            <Icon name="check" />
          </span>
          <p>{t.sentMessage}</p>
        </div>
      ) : (
        <form id="forgot-password-form" className="forgot-password-form" onSubmit={onSubmit}>
          <p>{t.description}</p>
          <label htmlFor="forgot-email">
            {t.emailLabel}
            <RequiredMark />
          </label>
          <div className="forgot-password-input-wrap">
            <input
              id="forgot-email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              required
              autoFocus
            />
          </div>
          {error && (
            <div className="forgot-password-error" role="alert">
              <Icon name="help" />
              <span>{error}</span>
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}
