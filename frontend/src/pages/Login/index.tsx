import { type FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import axios from "axios";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE_URL, apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { getDeviceIdentity } from "@/auth/device";
import { GoogleIcon } from "@/components/auth/GoogleIcon";
import { HeroSlider } from "@/components/auth/HeroSlider";
import { PasswordInput } from "@/components/PasswordInput";
import { RequiredMark } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { ALL_ROLE_OPTIONS, destinationFor, roleLabel } from "./helpers";
import { loginStrings as strings } from "./Login.strings";
import type { LoginProps } from "./types";
import { RoleTabs } from "./components/RoleTabs";
import { ForgotPasswordModal } from "./components/ForgotPasswordModal";

export { HeroSlider };

interface LoginStartResponse {
  access_token?: string | null;
  otp_required?: boolean;
  otp_challenge_id?: string | null;
  otp_delivery?: "email" | string | null;
  message?: string | null;
  totp_required?: boolean;
}

export function Login({
  allowedRoles = ["INSTITUTE_ADMIN", "INST_INSTRUCTOR", "STUDENT"],
  title = strings.defaultTitle,
  subtitle = strings.defaultSubtitle,
  disableAnimation = false,
}: LoginProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!containerRef.current || disableAnimation) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(".login-ref-card", { autoAlpha: 0, scale: 0.9, y: 20 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.35, ease: "back.out(1.2)", delay: 0.05 });

      gsap.fromTo(".glowing-orb", { autoAlpha: 0, scale: 0.8 }, { autoAlpha: 0.6, scale: 1, duration: 0.6, ease: "power2.out", stagger: 0.1 });
    }, containerRef);
    return () => ctx.revert();
  }, [disableAnimation]);
  const setSession = useAuthStore((state) => state.setSession);
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  async function handleForgotSubmit(e: FormEvent) {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError(null);
    try {
      await apiClient.post("/auth/forgot-password", { email: forgotEmail });
      setForgotSent(true);
    } catch (err: unknown) {
      setForgotError(extractErrorMessage(err, strings.forgotModal.genericError));
    } finally {
      setForgotLoading(false);
    }
  }
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [otpChallengeId, setOtpChallengeId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpValues, setOtpValues] = useState<string[]>(Array(6).fill(""));
  const [timerSeconds, setTimerSeconds] = useState(600); // 10 minutes = 600 seconds
  const [resendCooldown, setResendCooldown] = useState(30); // 30s resend cooldown
  const [resendLoading, setResendLoading] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setOtpCode(otpValues.join(""));
  }, [otpValues]);

  useEffect(() => {
    if (otpChallengeId) {
      setOtpValues(Array(6).fill(""));
      setTimerSeconds(600);
      setResendCooldown(30);
      // Focus first input box
      setTimeout(() => {
        otpRefs.current[0]?.focus();
      }, 50);
    }
  }, [otpChallengeId]);

  // 10-Minute Expiry Countdown Timer
  useEffect(() => {
    if (!otpChallengeId || timerSeconds <= 0) return;
    const timer = setInterval(() => {
      setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpChallengeId, timerSeconds]);

  // Resend Cooldown Timer
  useEffect(() => {
    if (!otpChallengeId || resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpChallengeId, resendCooldown]);

  const isExpired = timerSeconds <= 0;

  function formatTimer(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  const [totpRequired, setTotpRequired] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const availableRoleOptions = ALL_ROLE_OPTIONS.filter((item) => allowedRoles.includes(item.role));

  const initialRole = (() => {
    const requested = searchParams.get("role");
    if (requested && allowedRoles.includes(requested)) return requested;
    return availableRoleOptions[0]?.role ?? allowedRoles[0] ?? "INSTITUTE_ADMIN";
  })();

  const [selectedRole, setSelectedRole] = useState<string>(initialRole);

  useEffect(() => {
    const requested = searchParams.get("role");
    if (requested && allowedRoles.includes(requested)) {
      setSelectedRole(requested);
    }
  }, [searchParams, allowedRoles]);

  useEffect(() => {
    const googleError = searchParams.get("google_error");
    if (googleError) {
      setError(googleError);
      showError(googleError, strings.authErrorTitle);
      return;
    }
    const challenge = searchParams.get("google_otp_challenge");
    if (challenge) {
      setOtpChallengeId(challenge);
      setOtpCode("");
      setOtpError(null);
      setTimerSeconds(600);
      setResendCooldown(30);
      showSuccess(strings.otpSentToast, strings.otpSentTitle);
      const cleanedParams = new URLSearchParams(searchParams);
      cleanedParams.delete("google_otp_challenge");
      cleanedParams.delete("google_otp_delivery");
      cleanedParams.delete("google_error");
      const nextSearch = cleanedParams.toString();
      window.history.replaceState(window.history.state, "", `${location.pathname}${nextSearch ? `?${nextSearch}` : ""}`);
    }
  }, [location.pathname, searchParams, showError, showSuccess]);

  function changePortal(role: string) {
    const option = ALL_ROLE_OPTIONS.find((item) => item.role === role);
    if (!option) return;
    setError(null);

    if (!allowedRoles.includes(role)) {
      navigate(option.basePath);
      return;
    }

    setSelectedRole(role);
    navigate(option.basePath, { replace: true });
  }

  function handleSwitchPortalMode(targetRole: string) {
    changePortal(targetRole);
  }

  function openOtpDialog(tokens: LoginStartResponse) {
    if (!tokens.otp_required || !tokens.otp_challenge_id) {
      throw new Error(strings.otpInvalidResponse);
    }
    setOtpChallengeId(tokens.otp_challenge_id);
    setOtpCode("");
    setOtpError(null);
    setTimerSeconds(600);
    setResendCooldown(30);
    showSuccess(strings.otpSentToast, strings.otpSentTitle);
  }

  async function completeLogin(accessToken?: string | null) {
    if (!accessToken) {
      throw new Error(strings.otpInvalidToken);
    }
    const { data: user } = await apiClient.get("/auth/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (user.role !== selectedRole) {
      setError(strings.roleMismatchError);
      showError(strings.roleMismatchToast, strings.roleMismatchTitle);
      return;
    }
    const destination = destinationFor(user);
    if (!destination) {
      setError(strings.noPortalError);
      showError(strings.noPortalToast, strings.loginFailedTitle);
      return;
    }
    setSession(accessToken, user);
    showSuccess(strings.welcomeToast(roleLabel(user.role)), strings.signedInTitle);
    navigate(destination);
  }

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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data: tokens } = await apiClient.post<LoginStartResponse>("/auth/login", {
        email: email.trim().toLowerCase(),
        password,
        role: selectedRole,
        remember_me: rememberMe,
        // Included on the second step of a developer login with authenticator 2FA.
        totp_code: totpRequired ? totpCode.trim() : undefined,
        ...getDeviceIdentity(),
      });
      if (tokens.totp_required) {
        // Password accepted; the developer account needs its authenticator code.
        setTotpRequired(true);
        setError(null);
        return;
      }
      if (tokens.otp_required) {
        openOtpDialog(tokens);
        return;
      }
      setTotpRequired(false);
      setTotpCode("");
      await completeLogin(tokens.access_token);
    } catch (requestError: unknown) {
      const msg = authErrorMessage(requestError);
      setError(msg);
      showError(msg, strings.authErrorTitle);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError(null);
    setGoogleLoading(true);
    const device = getDeviceIdentity();
    const returnParams = new URLSearchParams(location.search);
    returnParams.delete("google_error");
    returnParams.delete("google_otp_challenge");
    returnParams.delete("google_otp_delivery");
    const returnSearch = returnParams.toString();
    const params = new URLSearchParams({
      role: selectedRole,
      return_path: `${location.pathname}${returnSearch ? `?${returnSearch}` : ""}`,
      remember_me: rememberMe ? "true" : "false",
      device_id: device.device_id,
      device_name: device.device_name,
    });
    window.location.href = `${API_BASE_URL}/auth/google/login?${params.toString()}`;
  }

  const handleOtpChange = (value: string, index: number) => {
    const cleanValue = value.replace(/\D/g, "");
    if (!cleanValue) {
      const newValues = [...otpValues];
      newValues[index] = "";
      setOtpValues(newValues);
      return;
    }

    const newValues = [...otpValues];
    const val = cleanValue.substring(cleanValue.length - 1);
    newValues[index] = val;
    setOtpValues(newValues);

    if (index < 5 && val) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace") {
      if (!otpValues[index] && index > 0) {
        const newValues = [...otpValues];
        newValues[index - 1] = "";
        setOtpValues(newValues);
        otpRefs.current[index - 1]?.focus();
      } else {
        const newValues = [...otpValues];
        newValues[index] = "";
        setOtpValues(newValues);
      }
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").replace(/\D/g, "").substring(0, 6);
    if (pasteData.length === 6) {
      const newValues = pasteData.split("");
      setOtpValues(newValues);
      otpRefs.current[5]?.focus();
    }
  };

  async function handleOtpSubmit(event: FormEvent) {
    event.preventDefault();
    if (!otpChallengeId || isExpired) return;
    setOtpError(null);
    setOtpLoading(true);
    try {
      const { data: tokens } = await apiClient.post<LoginStartResponse>("/auth/verify-otp", {
        challenge_id: otpChallengeId,
        otp_code: otpCode.trim(),
      });
      await completeLogin(tokens.access_token);
      setOtpChallengeId(null);
    } catch (requestError: unknown) {
      const msg = authErrorMessage(requestError);
      setOtpError(msg);
      showError(msg, strings.authErrorTitle);
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleResendOtp() {
    if (resendLoading || resendCooldown > 0) return;
    setResendLoading(true);
    setOtpError(null);
    try {
      const { data } = await apiClient.post<LoginStartResponse>("/auth/resend-otp", {
        challenge_id: otpChallengeId,
        email: email.trim().toLowerCase() || undefined,
        role: selectedRole,
      });
      if (data.otp_challenge_id) {
        setOtpChallengeId(data.otp_challenge_id);
      }
      setTimerSeconds(600);
      setResendCooldown(30);
      setOtpValues(Array(6).fill(""));
      showSuccess(strings.otpResentToast, strings.otpSentTitle);
      setTimeout(() => {
        otpRefs.current[0]?.focus();
      }, 50);
    } catch (requestError: unknown) {
      const msg = authErrorMessage(requestError);
      setOtpError(msg);
      showError(msg, strings.authErrorTitle);
    } finally {
      setResendLoading(false);
    }
  }

  function handleBackToLogin() {
    setOtpChallengeId(null);
    setOtpError(null);
    setOtpValues(Array(6).fill(""));
  }

  const isSuperAdminPortal = selectedRole === "SUPER_ADMIN" || selectedRole === "SA_INSTRUCTOR";
  const isDeveloperPortal = selectedRole === "DEVELOPER";

  const activeRoleOptions = isDeveloperPortal
    ? ALL_ROLE_OPTIONS.filter((item) => item.role === "DEVELOPER")
    : isSuperAdminPortal
    ? ALL_ROLE_OPTIONS.filter((item) => item.role === "SUPER_ADMIN" || item.role === "SA_INSTRUCTOR")
    : ALL_ROLE_OPTIONS.filter((item) => item.role === "INSTITUTE_ADMIN" || item.role === "INST_INSTRUCTOR" || item.role === "STUDENT");
  const scopedRoleOptions = activeRoleOptions.filter((item) => allowedRoles.includes(item.role));

  return (
    <div className="login-concise-page" ref={containerRef}>
      <div className="login-glowing-orbs" aria-hidden="true">
        <div className="glowing-orb orb-secondary" />
        <div className="glowing-orb orb-tertiary" />
      </div>

      <div className="login-ref-card">
        <div className="login-slider-container">
          <HeroSlider />
        </div>

        <div className={`login-form-side ${otpChallengeId ? "has-otp-view" : ""}`}>
          {otpChallengeId ? (
            /* Premium Inline OTP Verification */
            <div className="login-otp-inline-view">
              <div className="login-form-header text-center">
                <div className="otp-badge-icon" aria-hidden="true">
                  <div className="otp-badge-glow" />
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </div>
                <h1 className="form-main-title">{strings.otpTitle}</h1>
                <p className="form-sub-title">
                  {email ? (
                    <>Enter the 6-digit code sent to <strong className="otp-email-highlight">{email}</strong></>
                  ) : (
                    strings.otpDescription
                  )}
                </p>
              </div>

              <form onSubmit={handleOtpSubmit} className="concise-form">
                <div className="otp-inputs-wrapper">
                  <div className="otp-inputs-container">
                    {otpValues.map((val, idx) => (
                      <input
                        key={idx}
                        ref={(el) => { otpRefs.current[idx] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={val}
                        onChange={(e) => handleOtpChange(e.target.value, idx)}
                        onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                        onPaste={handleOtpPaste}
                        className={`otp-box-input ${val ? "is-filled" : ""} ${isExpired ? "is-expired" : ""}`}
                        autoComplete="one-time-code"
                        disabled={otpLoading || isExpired}
                        aria-label={`Digit ${idx + 1}`}
                        required
                      />
                    ))}
                  </div>
                </div>

                {/* Sleek Expiry Timer Pill & Resend Action */}
                <div className="otp-status-container">
                  <div className={`otp-timer-pill ${timerSeconds <= 60 ? "is-warning" : ""} ${isExpired ? "is-expired" : ""}`}>
                    <span className="otp-timer-pulse-dot" />
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span className="otp-timer-text">
                      {isExpired ? strings.otpExpired : strings.otpExpiresIn(formatTimer(timerSeconds))}
                    </span>
                  </div>

                  <div className="otp-resend-row">
                    <span className="otp-resend-prompt">Didn't receive code?</span>
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={resendLoading || resendCooldown > 0}
                      className={`otp-resend-pill-btn ${resendCooldown === 0 && !resendLoading ? "is-active" : ""}`}
                    >
                      {resendLoading ? (
                        <>
                          <span className="otp-spin-dot" />
                          <span>{strings.otpResendingLabel}</span>
                        </>
                      ) : resendCooldown > 0 ? (
                        <span>{strings.otpResendCooldown(resendCooldown)}</span>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                            <path d="M21 3v5h-5" />
                            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                            <path d="M8 16H3v5" />
                          </svg>
                          <span>{strings.otpResendLabel}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {otpError && <div className="concise-error-box otp-error-box">{otpError}</div>}

                <div className="otp-inline-actions">
                  <button
                    type="button"
                    className="otp-btn-back"
                    disabled={otpLoading}
                    onClick={handleBackToLogin}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                    {strings.otpBackToLogin}
                  </button>
                  <button
                    type="submit"
                    className={`concise-submit-btn otp-btn-submit ${otpCode.length === 6 && !isExpired ? "is-ready" : ""}`}
                    disabled={otpLoading || otpCode.length < 6 || isExpired}
                  >
                    {otpLoading ? (
                      strings.otpVerifyBusy
                    ) : (
                      <>
                        {strings.otpVerifyLabel}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14" />
                          <path d="m12 5 7 7-7 7" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Standard Email & Password Dialog */
            <>
              <div className="login-form-header text-center">
                <h1 className="form-main-title">
                  {title === strings.defaultTitle ? (
                    <>
                      Welcome <span className="vh-auth-italic">{strings.welcomeBack}</span>
                    </>
                  ) : (
                    title
                  )}
                </h1>
                <p className="form-sub-title">{subtitle}</p>
              </div>

              <RoleTabs options={scopedRoleOptions} selectedRole={selectedRole} onSelect={changePortal} />

              <form onSubmit={handleSubmit} className="concise-form">
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
                  <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder={strings.passwordPlaceholder} />
                  <div className="below-password-row">
                    <a
                      href="#forgot"
                      className="inline-forgot-link"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowForgotModal(true);
                        if (email) setForgotEmail(email);
                      }}
                    >
                      {strings.forgotPasswordLink}
                    </a>
                  </div>
                </div>

                {totpRequired && (
                  <div className="form-group">
                    <label htmlFor="totp-code">Authenticator code</label>
                    <input
                      id="totp-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="6-digit code"
                      autoFocus
                    />
                    <small className="hint">Enter the current code from your authenticator app.</small>
                  </div>
                )}

                <div className="remember-row">
                  <label className="toggle-switch-container">
                    <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="toggle-switch-input" />
                    <span className="toggle-switch-slider" />
                    <span className="toggle-switch-text">{strings.rememberMeLabel}</span>
                  </label>
                </div>

                {error && <div className="concise-error-box">{error}</div>}

                <button type="submit" className="concise-submit-btn" disabled={loading}>
                  {loading ? strings.signInBusy : strings.signInLabel(roleLabel(selectedRole))}
                </button>
                <button
                  type="button"
                  className="google-login-btn"
                  disabled={loading || googleLoading}
                  onClick={handleGoogleLogin}
                >
                  <span className="google-mark" aria-hidden="true">
                    <GoogleIcon />
                  </span>
                  {googleLoading ? strings.googleLoginBusy : strings.googleLoginLabel}
                </button>
              </form>

              <div className="login-footer-links text-center">
                <p className={`form-legal-note${selectedRole === "STUDENT" ? "" : " is-placeholder"}`} aria-hidden={selectedRole !== "STUDENT"}>
                  {strings.registerPrompt}
                  <a href="/register">{strings.registerLink}</a>
                </p>

                {isDeveloperPortal ? (
                  <p className="form-legal-note is-placeholder" aria-hidden="true">
                    Developer access
                  </p>
                ) : isSuperAdminPortal ? (
                  <p className="form-legal-note">
                    {strings.institutePortalPrompt}
                    <button
                      type="button"
                      onClick={() => handleSwitchPortalMode("INSTITUTE_ADMIN")}
                      style={{ background: "none", border: "none", color: "#e11d2e", fontWeight: 700, cursor: "pointer", padding: 0, fontSize: "inherit", textDecoration: "underline" }}
                    >
                      {strings.institutePortalLink}
                    </button>
                  </p>
                ) : (
                  <p className="form-legal-note">
                    {strings.superAdminPrompt}
                    <button
                      type="button"
                      onClick={() => handleSwitchPortalMode("SUPER_ADMIN")}
                      style={{ background: "none", border: "none", color: "#e11d2e", fontWeight: 750, cursor: "pointer", padding: 0, fontSize: "inherit", textDecoration: "underline" }}
                    >
                      {strings.superAdminLink}
                    </button>
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {showForgotModal && (
        <ForgotPasswordModal
          email={forgotEmail}
          onEmailChange={setForgotEmail}
          sent={forgotSent}
          loading={forgotLoading}
          error={forgotError}
          onSubmit={handleForgotSubmit}
          onClose={() => setShowForgotModal(false)}
          onDone={() => {
            setShowForgotModal(false);
            setForgotSent(false);
          }}
        />
      )}
    </div>
  );
}
