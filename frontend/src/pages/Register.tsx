import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL, apiClient } from "@/api/client";
import { getDeviceIdentity } from "@/auth/device";
import { extractErrorMessage } from "@/api/errors";
import { HeroSlider } from "@/components/auth/HeroSlider";
import { PasswordInput } from "@/components/PasswordInput";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";
import { RequiredMark } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { registerStrings as strings } from "./Register.strings";

import { evaluatePassword } from "@/utils/passwordStrength";

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
  const [googleLoading, setGoogleLoading] = useState(false);

  const [otpChallengeId, setOtpChallengeId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);

  function authErrorMessage(requestError: unknown) {
    if (axios.isAxiosError(requestError)) {
      const detail = requestError.response?.data?.detail;
      return typeof detail === "string" ? detail : strings.connectionError;
    }
    if (requestError instanceof Error && requestError.message) {
      return requestError.message;
    }
    return strings.genericAuthError;
  }

  async function completeLogin(accessToken?: string | null) {
    if (!accessToken) {
      throw new Error(strings.otpInvalidToken);
    }
    const { data: user } = await apiClient.get("/auth/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    setSession(accessToken, user);
    navigate("/student/dashboard");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const strength = evaluatePassword(password);
    if (!strength.allMet) {
      const unmet = strength.rules.find((r) => !r.met);
      const msg = unmet
        ? `Password requirement missing: ${unmet.label}`
        : "Password must be at least 8 characters long with uppercase, lowercase, digit, and special character.";
      setError(msg);
      showError(msg, strings.errorTitle);
      return;
    }

    setLoading(true);
    try {
      const { data: tokens } = await apiClient.post("/auth/register", {
        email: email.trim().toLowerCase(),
        password,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        ...getDeviceIdentity(),
      });
      
      if (tokens.otp_required) {
        if (!tokens.otp_challenge_id) {
          throw new Error(strings.otpInvalidResponse);
        }
        setOtpChallengeId(tokens.otp_challenge_id);
        setOtpCode("");
        setOtpError(null);
        showSuccess(strings.otpSentToast, strings.otpSentTitle);
        return;
      }
      
      await completeLogin(tokens.access_token);
    } catch (requestError: unknown) {
      const msg = extractErrorMessage(requestError, strings.errorFallback);
      setError(msg);
      showError(msg, strings.errorTitle);
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleSignup() {
    setError(null);
    setGoogleLoading(true);
    const device = getDeviceIdentity();
    const params = new URLSearchParams({
      role: "STUDENT",
      mode: "register",
      return_path: "/login?role=STUDENT",
      remember_me: "true",
      device_id: device.device_id,
      device_name: device.device_name,
    });
    window.location.href = `${API_BASE_URL}/auth/google/login?${params.toString()}`;
  }

  async function handleOtpSubmit(event: FormEvent) {
    event.preventDefault();
    setOtpError(null);
    setOtpLoading(true);
    try {
      const { data: tokens } = await apiClient.post("/auth/verify-otp", {
        challenge_id: otpChallengeId,
        otp_code: otpCode.trim(),
      });
      await completeLogin(tokens.access_token);
    } catch (requestError: unknown) {
      setOtpError(authErrorMessage(requestError));
    } finally {
      setOtpLoading(false);
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
            <div className="auth-name-grid">
              <div className="form-group">
                <label htmlFor="first_name">{strings.firstNameLabel}<RequiredMark /></label>
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
                <label htmlFor="last_name">{strings.lastNameLabel}<RequiredMark /></label>
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
              <label htmlFor="email">{strings.emailLabel}<RequiredMark /></label>
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
            <button
              type="button"
              className="google-login-btn"
              disabled={loading || googleLoading}
              onClick={handleGoogleSignup}
            >
              <span className="google-mark" aria-hidden="true">G</span>
              {googleLoading ? strings.googleSignupBusy : strings.googleSignupLabel}
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
      
      {otpChallengeId && (
        <div className="logout-modal-backdrop otp-login-backdrop" role="presentation">
          <form className="logout-modal-card otp-login-card" onSubmit={handleOtpSubmit}>
            <div className="logout-modal-icon-badge otp-login-icon ui-otp-badge" aria-hidden="true">OTP</div>
            <h2 className="logout-modal-title">{strings.otpTitle}</h2>
            <p className="logout-modal-description">
              {strings.otpDescription}
            </p>
            <label className="otp-code-label" htmlFor="register-otp-code">{strings.otpLabel}</label>
            <input
              id="register-otp-code"
              className="otp-code-input"
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value)}
              placeholder={strings.otpPlaceholder}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
            />
            {otpError && <div className="concise-error-box otp-error-box">{otpError}</div>}
            <div className="logout-modal-actions">
              <button
                type="button"
                className="logout-modal-btn cancel-btn"
                disabled={otpLoading}
                onClick={() => setOtpChallengeId(null)}
              >
                {strings.otpCancelLabel}
              </button>
              <button type="submit" className="logout-modal-btn confirm-btn" disabled={otpLoading}>
                {otpLoading ? strings.otpVerifyBusy : strings.otpVerifyLabel}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
