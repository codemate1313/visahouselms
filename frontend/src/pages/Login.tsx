import { type FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiClient } from "../api/client";
import { extractErrorMessage } from "../api/errors";
import { getDeviceIdentity } from "../auth/device";
import { PasswordInput } from "../components/PasswordInput";
import { useAuthStore } from "../store/authStore";
import { useToastStore } from "../store/toastStore";
import { useLoginSliderStore } from "../store/loginSliderStore";

interface LoginProps {
  allowedRoles?: string[];
  title?: string;
  subtitle?: string;
  disableAnimation?: boolean;
}

const ALL_ROLE_OPTIONS = [
  { role: "INSTITUTE_ADMIN", label: "Institute", basePath: "/login" },
  { role: "INST_INSTRUCTOR", label: "Instructor", basePath: "/login?role=INST_INSTRUCTOR" },
  { role: "STUDENT", label: "Student", basePath: "/login?role=STUDENT" },
  { role: "SUPER_ADMIN", label: "Super Admin", basePath: "/super-admin/login" },
  { role: "SA_INSTRUCTOR", label: "SA Instructor", basePath: "/super-admin/login?role=SA_INSTRUCTOR" },
] as const;

function roleLabel(role: string) {
  return ALL_ROLE_OPTIONS.find((option) => option.role === role)?.label ?? role;
}

function destinationFor(user: { role: string; force_password_reset: boolean }) {
  if (user.role === "SUPER_ADMIN") return user.force_password_reset ? "/super-admin/change-password" : "/super-admin/dashboard";
  if (user.role === "SA_INSTRUCTOR") return user.force_password_reset ? "/super-admin/instructor/change-password" : "/super-admin/instructor/dashboard";
  if (user.role === "INSTITUTE_ADMIN") return "/institute-portal";
  if (user.role === "INST_INSTRUCTOR") return user.force_password_reset ? "/institute-instructor/change-password" : "/institute-instructor/grading";
  if (user.role === "STUDENT") return "/student/dashboard";
  return null;
}

export function HeroSlider() {
  const slides = useLoginSliderStore((state) => state.slides);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length, isPaused]);

  const activeSlide = slides[currentSlideIndex] ?? slides[0];

  return (
    <div
      className="login-hero-slider"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Sliding Window Track */}
      <div
        className="hero-slider-track"
        style={{ transform: `translateX(-${currentSlideIndex * 100}%)` }}
      >
        {slides.map((slide) => (
          <div key={slide.id} className="hero-slide-item">
            <img src={slide.imageUrl} alt={slide.title} className="hero-slide-img" />
            <div className="hero-slide-overlay" />
          </div>
        ))}
      </div>

      {/* Slide Content Overlay */}
      <div className="hero-slide-content" key={activeSlide.id}>
        <span className="hero-kicker-badge">{activeSlide.badge}</span>
        <h2 className="hero-slide-title">{activeSlide.title}</h2>
        <p className="hero-slide-subtitle">{activeSlide.subtitle}</p>

        {/* Interactive Dots Pagination */}
        {slides.length > 1 && (
          <div className="hero-slider-dots">
            {slides.map((slide, idx) => (
              <button
                key={slide.id}
                type="button"
                className={`slider-dot ${idx === currentSlideIndex ? "active" : ""}`}
                onClick={() => setCurrentSlideIndex(idx)}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Login({
  allowedRoles = ["INSTITUTE_ADMIN", "INST_INSTRUCTOR", "STUDENT"],
  title = "IELTS LMS",
  subtitle = "Enter your credentials to access your dashboard",
  disableAnimation = false,
}: LoginProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!containerRef.current || disableAnimation) return;
    const ctx = gsap.context(() => {
      // Premium popup animation for the main card (sped up)
      gsap.fromTo(
        ".login-ref-card",
        { autoAlpha: 0, scale: 0.9, y: 20 },
        { autoAlpha: 1, scale: 1, y: 0, duration: 0.35, ease: "back.out(1.2)", delay: 0.05 }
      );

      // Staggered fade-in for background orbs
      gsap.fromTo(
        ".glowing-orb",
        { autoAlpha: 0, scale: 0.8 },
        { autoAlpha: 0.6, scale: 1, duration: 0.6, ease: "power2.out", stagger: 0.1 }
      );
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
      setForgotError(extractErrorMessage(err, "Failed to send reset link."));
    } finally {
      setForgotLoading(false);
    }
  }
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Filter available role tab options based on allowedRoles
  const availableRoleOptions = ALL_ROLE_OPTIONS.filter((item) =>
    allowedRoles.includes(item.role)
  );

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
        setError("This role does not have a portal yet.");
        showError("This role does not have an active portal yet.", "Login Failed");
        return;
      }
      setSession(tokens.access_token, user);
      showSuccess(`Welcome back, ${roleLabel(user.role)}!`, "Signed In");
      navigate(destination);
    } catch (requestError: unknown) {
      let msg = "Unable to sign in. Please try again.";
      if (axios.isAxiosError(requestError)) {
        const detail = requestError.response?.data?.detail;
        msg = typeof detail === "string" ? detail : "Unable to connect to the login service.";
      }
      setError(msg);
      showError(msg, "Authentication Error");
    } finally {
      setLoading(false);
    }
  }

  // Check active portal mode based on selectedRole
  const isSuperAdminPortal = selectedRole === "SUPER_ADMIN" || selectedRole === "SA_INSTRUCTOR";

  const activeRoleOptions = isSuperAdminPortal
    ? ALL_ROLE_OPTIONS.filter((item) => item.role === "SUPER_ADMIN" || item.role === "SA_INSTRUCTOR")
    : ALL_ROLE_OPTIONS.filter((item) => item.role === "INSTITUTE_ADMIN" || item.role === "INST_INSTRUCTOR" || item.role === "STUDENT");

  const activeIndex = activeRoleOptions.findIndex((opt) => opt.role === selectedRole);
  const totalTabs = activeRoleOptions.length || 1;
  const safeActiveIndex = activeIndex >= 0 ? activeIndex : 0;

  return (
    <div className="login-concise-page" ref={containerRef}>
      {/* Dynamic Glowing Orbs Background Layer */}
      <div className="login-glowing-orbs" aria-hidden="true">
        <div className="glowing-orb orb-primary" />
        <div className="glowing-orb orb-secondary" />
        <div className="glowing-orb orb-tertiary" />
      </div>

      <div className="login-ref-card">
        {/* Left Side: Animated Hero Image Slider */}
        <div className="login-slider-container">
          <HeroSlider />
        </div>

        {/* Right Side: Clean Form */}
        <div className="login-form-side">
          <div className="vh-auth-brand">
            <span className="vh-auth-logo">VH</span>
            <div>
              <div className="vh-auth-name">Visa House</div>
              <div className="vh-auth-tag">IELTS LMS</div>
            </div>
          </div>

          <div className="login-form-header text-center">
            <h1 className="form-main-title">
              {title === "IELTS LMS" ? (
                <>
                  Welcome <span className="vh-auth-italic">back.</span>
                </>
              ) : (
                title
              )}
            </h1>
            <p className="form-sub-title">{subtitle}</p>
          </div>

          {/* Switchable Role Tabs with Smooth Sliding Indicator */}
          <div
            className="login-role-tabs-bar"
            role="tablist"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${totalTabs}, 1fr)`,
            }}
          >
            <div
              className="role-tab-indicator"
              style={{
                width: `calc((100% - 8px) / ${totalTabs})`,
                transform: `translateX(calc(${safeActiveIndex} * (100% - 2px)))`,
              }}
            />
            {activeRoleOptions.map((option) => {
              const isActive = option.role === selectedRole;
              return (
                <button
                  key={option.role}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`role-tab-btn ${isActive ? "active" : ""}`}
                  onClick={() => changePortal(option.role)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} className="concise-form">
            <div className="form-group">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
              />
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
                  Forgot password?
                </a>
              </div>
            </div>

            <div className="remember-row">
              <label className="toggle-switch-container">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="toggle-switch-input"
                />
                <span className="toggle-switch-slider" />
                <span className="toggle-switch-text">Remember me on this device</span>
              </label>
            </div>

            {error && <div className="concise-error-box">{error}</div>}

            <button type="submit" className="concise-submit-btn" disabled={loading}>
              {loading ? "Signing in..." : `Sign in as ${roleLabel(selectedRole)} →`}
            </button>
          </form>

          <div className="login-footer-links text-center">
            <p
              className={`form-legal-note${selectedRole === "STUDENT" ? "" : " is-placeholder"}`}
              aria-hidden={selectedRole !== "STUDENT"}
            >
              New student? <a href="/register">Create a student account</a>
            </p>

            {isSuperAdminPortal ? (
              <p className="form-legal-note">
                Institute Admin or Student?{" "}
                <button
                  type="button"
                  onClick={() => handleSwitchPortalMode("INSTITUTE_ADMIN")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--rose-600)",
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: 0,
                    fontSize: "inherit",
                    textDecoration: "underline"
                  }}
                >
                  Go to Portal Login
                </button>
              </p>
            ) : (
              <p className="form-legal-note">
                Platform Admin?{" "}
                <button
                  type="button"
                  onClick={() => handleSwitchPortalMode("SUPER_ADMIN")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--rose-600)",
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: 0,
                    fontSize: "inherit",
                    textDecoration: "underline"
                  }}
                >
                  Super Admin Login
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      {showForgotModal && (
        <div className="logout-modal-backdrop" onClick={() => setShowForgotModal(false)} role="presentation">
          <div className="logout-modal-card" onClick={(e) => e.stopPropagation()} role="dialog" style={{ maxWidth: 420 }}>
            <h2 className="logout-modal-title">Reset Password</h2>
            <p className="logout-modal-description">
              Enter your account email address. We'll send you an email with a secure link to reset your password.
            </p>
            {forgotSent ? (
              <div style={{ padding: "16px 0", textAlign: "center" }}>
                <div style={{ background: "var(--shade-dcfce7)", color: "var(--green-700)", padding: "12px 16px", borderRadius: 8, fontSize: 13.5, marginBottom: 16, border: "1px solid var(--green-300)" }}>
                  Reset link sent! Check your email inbox for instructions.
                </div>
                <button
                  type="button"
                  className="concise-submit-btn"
                  onClick={() => {
                    setShowForgotModal(false);
                    setForgotSent(false);
                  }}
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} style={{ marginTop: 16 }}>
                <div className="form-group" style={{ textAlign: "left", marginBottom: 16 }}>
                  <label htmlFor="forgot-email">Email Address</label>
                  <input
                    id="forgot-email"
                    type="email"
                    placeholder="name@example.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                  />
                </div>
                {forgotError && <div className="concise-error-box" style={{ marginBottom: 16 }}>{forgotError}</div>}
                <div className="logout-modal-actions" style={{ display: "flex", gap: 10, marginTop: 20 }}>
                  <button
                    type="button"
                    className="logout-modal-btn cancel-btn"
                    onClick={() => setShowForgotModal(false)}
                    disabled={forgotLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="logout-modal-btn confirm-btn btn-primary"
                    disabled={forgotLoading || !forgotEmail}
                    style={{ background: "var(--sa-sidebar-red)", color: "var(--white)" }}
                  >
                    {forgotLoading ? "Sending..." : "Send Reset Link"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
