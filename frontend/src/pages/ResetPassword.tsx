import { type FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { PasswordInput } from "@/components/PasswordInput";
import { Icon } from "@/components/icons";
import { resetPasswordStrings as strings } from "./ResetPassword.strings";

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token) {
      setError(strings.missingTokenError);
      return;
    }
    if (password !== confirmPassword) {
      setError(strings.passwordMismatchError);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await apiClient.post("/auth/reset-password", {
        token,
        new_password: password,
      });
      setSuccess(true);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.genericError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page-container" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "var(--surface-muted)" }}>
      <div
        className="login-card-container"
        style={{ width: "100%", maxWidth: 440, background: "var(--surface)", padding: 32, borderRadius: 16, border: "1px solid var(--border)", boxShadow: "0 10px 30px rgba(var(--slate-900-rgb), 0.06)", position: "relative" }}
      >
        {/* Close Button */}
        <Link 
          to="/login"
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: "var(--text-muted)",
            transition: 'all 0.2s',
            zIndex: 10,
            textDecoration: 'none'
          }}
          onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "var(--surface-muted)"; e.currentTarget.style.color = "var(--text)"; }}
          onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "var(--surface)"; e.currentTarget.style.color = "var(--text-muted)"; }}
        >
          <Icon name="x" />
        </Link>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              display: "inline-block",
              padding: "6px 14px",
              background: "rgba(var(--sa-sidebar-red-rgb), 0.1)",
              borderRadius: 20,
              color: "var(--sa-sidebar-red)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            {strings.eyebrow}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: "4px 0" }}>{strings.title}</h1>
          <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: 0 }}>{strings.subtitle}</p>
        </div>

        {success ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--shade-dcfce7)", color: "var(--green-600)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px auto" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>{strings.success.title}</h2>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24 }}>{strings.success.description}</p>
            <Link to="/login" className="concise-submit-btn" style={{ textDecoration: "none", display: "block", textAlign: "center" }}>
              {strings.success.signInLink}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="concise-form">
            {!token && (
              <div className="concise-error-box" style={{ marginBottom: 16 }}>
                {strings.invalidTokenBanner}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="new-password">{strings.newPasswordLabel}</label>
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder={strings.newPasswordPlaceholder} />
            </div>

            <div className="form-group">
              <label htmlFor="confirm-password">{strings.confirmPasswordLabel}</label>
              <PasswordInput value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={strings.confirmPasswordPlaceholder} />
            </div>

            {error && <div className="concise-error-box">{error}</div>}

            <button type="submit" className="concise-submit-btn" disabled={loading || !token} style={{ marginTop: 16 }}>
              {loading ? strings.submitBusy : strings.submitLabel}
            </button>

            <div style={{ textAlign: "center", marginTop: 20 }}>
              <Link to="/login" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none", fontWeight: 600 }}>
                {strings.returnToSignIn}
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
