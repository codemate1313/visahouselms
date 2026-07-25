import { type FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { getDeviceIdentity } from "@/auth/device";
import { HeroSlider } from "@/components/auth/HeroSlider";
import { PasswordInput } from "@/components/PasswordInput";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { ALL_ROLE_OPTIONS, destinationFor, roleLabel } from "./helpers";
import { loginStrings as strings } from "./Login.strings";
import type { LoginProps } from "./types";
import { RoleTabs } from "./components/RoleTabs";
import { ForgotPasswordModal } from "./components/ForgotPasswordModal";

export { HeroSlider };

export function Login({
  allowedRoles = ["INSTITUTE_ADMIN", "INST_INSTRUCTOR", "STUDENT"],
  title = strings.defaultTitle,
  subtitle = strings.defaultSubtitle,
  disableAnimation = false,
}: LoginProps) {
  const navigate = useNavigate();
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
  const [rememberMe, setRememberMe] = useState(true);

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

  function changePortal(role: string) {
    const option = ALL_ROLE_OPTIONS.find((item) => item.role === role);
    if (!option) return;
    setError(null);
    setSelectedRole(role);
    window.history.replaceState(window.history.state, "", option.basePath);
  }

  function handleSwitchPortalMode(targetRole: string) {
    changePortal(targetRole);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data: tokens } = await apiClient.post("/auth/login", {
        email: email.trim().toLowerCase(),
        password,
        ...getDeviceIdentity(),
      });
      const { data: user } = await apiClient.get("/auth/me", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const destination = destinationFor(user);
      if (!destination) {
        setError(strings.noPortalError);
        showError(strings.noPortalToast, strings.loginFailedTitle);
        return;
      }
      setSession(tokens.access_token, user);
      showSuccess(strings.welcomeToast(roleLabel(user.role)), strings.signedInTitle);
      navigate(destination);
    } catch (requestError: unknown) {
      let msg = strings.genericAuthError;
      if (axios.isAxiosError(requestError)) {
        const detail = requestError.response?.data?.detail;
        msg = typeof detail === "string" ? detail : strings.connectionError;
      }
      setError(msg);
      showError(msg, strings.authErrorTitle);
    } finally {
      setLoading(false);
    }
  }

  const isSuperAdminPortal = selectedRole === "SUPER_ADMIN" || selectedRole === "SA_INSTRUCTOR";

  const activeRoleOptions = isSuperAdminPortal
    ? ALL_ROLE_OPTIONS.filter((item) => item.role === "SUPER_ADMIN" || item.role === "SA_INSTRUCTOR")
    : ALL_ROLE_OPTIONS.filter((item) => item.role === "INSTITUTE_ADMIN" || item.role === "INST_INSTRUCTOR" || item.role === "STUDENT");

  return (
    <div className="login-concise-page" ref={containerRef}>
      <div className="login-glowing-orbs" aria-hidden="true">
        <div className="glowing-orb orb-primary" />
        <div className="glowing-orb orb-secondary" />
        <div className="glowing-orb orb-tertiary" />
      </div>

      <div className="login-ref-card">
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

          <RoleTabs options={activeRoleOptions} selectedRole={selectedRole} onSelect={changePortal} />

          <form onSubmit={handleSubmit} className="concise-form">
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
          </form>

          <div className="login-footer-links text-center">
            <p className={`form-legal-note${selectedRole === "STUDENT" ? "" : " is-placeholder"}`} aria-hidden={selectedRole !== "STUDENT"}>
              {strings.registerPrompt}
              <a href="/register">{strings.registerLink}</a>
            </p>

            {isSuperAdminPortal ? (
              <p className="form-legal-note">
                {strings.institutePortalPrompt}
                <button
                  type="button"
                  onClick={() => handleSwitchPortalMode("INSTITUTE_ADMIN")}
                  style={{ background: "none", border: "none", color: "var(--rose-600)", fontWeight: 700, cursor: "pointer", padding: 0, fontSize: "inherit", textDecoration: "underline" }}
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
                  style={{ background: "none", border: "none", color: "var(--rose-600)", fontWeight: 750, cursor: "pointer", padding: 0, fontSize: "inherit", textDecoration: "underline" }}
                >
                  {strings.superAdminLink}
                </button>
              </p>
            )}
          </div>
        </div>

        <div className="login-slider-container">
          <HeroSlider />
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
