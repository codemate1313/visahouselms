import type { FormEvent } from "react";
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

export function ForgotPasswordModal({ email, onEmailChange, sent, loading, error, onSubmit, onClose, onDone }: ForgotPasswordModalProps) {
  const t = strings.forgotModal;
  return (
    <div className="logout-modal-backdrop" onClick={onClose} role="presentation">
      <div className="logout-modal-card" onClick={(e) => e.stopPropagation()} role="dialog" style={{ maxWidth: 420 }}>
        <h2 className="logout-modal-title">{t.title}</h2>
        <p className="logout-modal-description">{t.description}</p>
        {sent ? (
          <div style={{ padding: "16px 0", textAlign: "center" }}>
            <div
              style={{
                background: "var(--shade-dcfce7)",
                color: "var(--green-700)",
                padding: "12px 16px",
                borderRadius: 8,
                fontSize: 13.5,
                marginBottom: 16,
                border: "1px solid var(--green-300)",
              }}
            >
              {t.sentMessage}
            </div>
            <button type="button" className="concise-submit-btn" onClick={onDone}>
              {t.doneLabel}
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} style={{ marginTop: 16 }}>
            <div className="form-group" style={{ textAlign: "left", marginBottom: 16 }}>
              <label htmlFor="forgot-email">{t.emailLabel}</label>
              <input id="forgot-email" type="email" placeholder="name@example.com" value={email} onChange={(e) => onEmailChange(e.target.value)} required />
            </div>
            {error && (
              <div className="concise-error-box" style={{ marginBottom: 16 }}>
                {error}
              </div>
            )}
            <div className="logout-modal-actions" style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button type="button" className="logout-modal-btn cancel-btn" onClick={onClose} disabled={loading}>
                {t.cancelLabel}
              </button>
              <button
                type="submit"
                className="logout-modal-btn confirm-btn btn-primary"
                disabled={loading || !email}
                style={{ background: "var(--sa-sidebar-red)", color: "var(--white)" }}
              >
                {loading ? t.sendBusy : t.sendLabel}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
