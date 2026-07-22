import { type FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiClient } from "../api/client";
import { extractErrorMessage } from "../api/errors";
import { PasswordInput } from "../components/PasswordInput";

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
      setError("Missing or invalid password reset token.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
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
      setError(extractErrorMessage(err, "Failed to reset password. The link may have expired."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page-container" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "#f8fafc" }}>
      <div className="login-card-container" style={{ width: "100%", maxWidth: 440, background: "#ffffff", padding: 32, borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ display: "inline-block", padding: "6px 14px", background: "rgba(185, 28, 43, 0.1)", borderRadius: 20, color: "#b91c2b", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
            Security
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: "4px 0" }}>Set New Password</h1>
          <p style={{ fontSize: 13.5, color: "#64748b", margin: 0 }}>Create a strong new password for your account</p>
        </div>

        {success ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#dcfce7", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px auto" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Password Reset Successfully!</h2>
            <p style={{ fontSize: 14, color: "#64748b", marginBottom: 24 }}>Your password has been updated. You can now sign in with your new credentials.</p>
            <Link to="/login" className="concise-submit-btn" style={{ textDecoration: "none", display: "block", textAlign: "center" }}>
              Sign in to Account &rarr;
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="concise-form">
            {!token && (
              <div className="concise-error-box" style={{ marginBottom: 16 }}>
                Invalid or missing reset token. Please request a new link.
              </div>
            )}

            <div className="form-group">
              <label htmlFor="new-password">New Password</label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirm-password">Confirm New Password</label>
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
              />
            </div>

            {error && <div className="concise-error-box">{error}</div>}

            <button type="submit" className="concise-submit-btn" disabled={loading || !token} style={{ marginTop: 16 }}>
              {loading ? "Resetting password..." : "Update Password &rarr;"}
            </button>

            <div style={{ textAlign: "center", marginTop: 20 }}>
              <Link to="/login" style={{ fontSize: 13, color: "#64748b", textDecoration: "none", fontWeight: 600 }}>
                &larr; Return to Sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
