import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiClient } from "@/api/client";
import { getDeviceIdentity } from "@/auth/device";
import { extractErrorMessage } from "@/api/errors";
import { HeroSlider } from "@/components/auth/HeroSlider";
import { PasswordInput } from "@/components/PasswordInput";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { registerStrings as strings } from "./Register.strings";

export function Register() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data: tokens } = await apiClient.post("/auth/register", {
        email: email.trim().toLowerCase(),
        password,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        ...getDeviceIdentity(),
      });
      const { data: user } = await apiClient.get("/auth/me", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      setSession(tokens.access_token, user);
      showSuccess(strings.welcomeToastMessage, strings.welcomeToastTitle);
      navigate("/student/dashboard");
    } catch (requestError: unknown) {
      const msg = extractErrorMessage(requestError, strings.errorFallback);
      setError(msg);
      showError(msg, strings.errorTitle);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-concise-page">
      <div className="login-glowing-orbs" aria-hidden="true">
        <div className="glowing-orb orb-primary" />
        <div className="glowing-orb orb-secondary" />
        <div className="glowing-orb orb-tertiary" />
      </div>

      <div className="login-ref-card">
        <div className="login-slider-container">
          <HeroSlider />
        </div>

        <div className="login-form-side">
          <div className="vh-auth-brand">
            <span className="vh-auth-logo">VH</span>
            <div>
              <div className="vh-auth-name">{strings.brandName}</div>
              <div className="vh-auth-tag">{strings.brandTag}</div>
            </div>
          </div>

          <div className="login-form-header text-center">
            <h1 className="form-main-title">
              Create <span className="vh-auth-italic">{strings.createAccount}</span>
            </h1>
            <p className="form-sub-title">{strings.subtitle}</p>
          </div>

          <form onSubmit={handleSubmit} className="concise-form">
            <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div className="form-group">
                <label htmlFor="first_name">{strings.firstNameLabel}</label>
                <input
                  id="first_name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  placeholder={strings.firstNamePlaceholder}
                  required
                  maxLength={100}
                  autoComplete="given-name"
                />
              </div>
              <div className="form-group">
                <label htmlFor="last_name">{strings.lastNameLabel}</label>
                <input
                  id="last_name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  placeholder={strings.lastNamePlaceholder}
                  required
                  maxLength={100}
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="email">{strings.emailLabel}</label>
              <input
                id="email"
                type="email"
                placeholder={strings.emailPlaceholder}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">{strings.passwordLabel}</label>
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder={strings.passwordPlaceholder} autoComplete="new-password" />
              <PasswordStrengthMeter password={password} />
            </div>

            {error && <div className="concise-error-box">{error}</div>}

            <button type="submit" className="concise-submit-btn" disabled={loading}>
              {loading ? strings.submitBusy : strings.submitLabel}
            </button>
          </form>

          <div className="login-footer-links text-center">
            <p className="form-legal-note">
              {strings.alreadyHaveAccount}
              <Link to="/login">{strings.signInLink}</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
