import { type FormEvent, useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { apiClient } from "../api/client";
import { getDeviceIdentity } from "../auth/device";
import { PasswordInput } from "../components/PasswordInput";
import { useAuthStore } from "../store/authStore";
import { useToastStore } from "../store/toastStore";
import { useLoginSliderStore } from "../store/loginSliderStore";

interface LoginProps {
  allowedRoles?: string[];
  title?: string;
  subtitle?: string;
  wrongRoleMessage?: string;
}

const ALL_ROLE_OPTIONS = [
  { role: "INSTITUTE_ADMIN", label: "Institute", basePath: "/login" },
  { role: "INST_INSTRUCTOR", label: "Instructor", basePath: "/login" },
  { role: "STUDENT", label: "Student", basePath: "/login" },
  { role: "SUPER_ADMIN", label: "Super Admin", basePath: "/super-admin/login" },
  { role: "SA_INSTRUCTOR", label: "SA Instructor", basePath: "/super-admin/login" },
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
  wrongRoleMessage = "Use the correct login page for this account.",
}: LoginProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setSession = useAuthStore((state) => state.setSession);
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Filter available role tab options based on allowedRoles
  const availableRoleOptions = ALL_ROLE_OPTIONS.filter((item) =>
    allowedRoles.includes(item.role)
  );

  const requestedRole = searchParams.get("role");
  const selectedRole = requestedRole && allowedRoles.includes(requestedRole)
    ? requestedRole
    : availableRoleOptions[0]?.role ?? allowedRoles[0] ?? "INSTITUTE_ADMIN";

  function changePortal(role: string) {
    const option = ALL_ROLE_OPTIONS.find((item) => item.role === role);
    if (!option) return;
    setError(null);
    navigate(`${option.basePath}?role=${role}`);
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
      if ((allowedRoles && !allowedRoles.includes(user.role)) || user.role !== selectedRole) {
        await apiClient.post("/auth/logout", { refresh_token: tokens.refresh_token }).catch(() => undefined);
        const roleMessage = allowedRoles?.includes(user.role)
          ? `This account belongs to ${roleLabel(user.role)}. Switch to that tab and sign in again.`
          : wrongRoleMessage;
        setError(roleMessage);
        showError(roleMessage, "Access Denied");
        return;
      }
      const destination = destinationFor(user);
      if (!destination) {
        setError("This role does not have a portal yet.");
        showError("This role does not have an active portal yet.", "Login Failed");
        return;
      }
      setSession(tokens.access_token, tokens.refresh_token, user);
      showSuccess(`Welcome back!`, "Signed In");
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

  const isSuperAdminPortal = allowedRoles.includes("SUPER_ADMIN") || allowedRoles.includes("SA_INSTRUCTOR");

  const activeIndex = availableRoleOptions.findIndex((opt) => opt.role === selectedRole);
  const totalTabs = availableRoleOptions.length || 1;
  const safeActiveIndex = activeIndex >= 0 ? activeIndex : 0;

  return (
    <div className="login-concise-page">
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
          <div className="login-form-header text-center">
            <h1 className="form-main-title">{title}</h1>
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
                width: `calc((100% - 8px - ${(totalTabs - 1) * 4}px) / ${totalTabs})`,
                transform: `translateX(calc(${safeActiveIndex} * (100% + 4px)))`,
              }}
            />
            {availableRoleOptions.map((option) => {
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
                <a href="#forgot" className="inline-forgot-link" onClick={(e) => e.preventDefault()}>
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
              {loading ? "Signing in..." : "Sign in →"}
            </button>
          </form>

          <div className="login-footer-links text-center">
            {selectedRole === "STUDENT" && (
              <p className="form-legal-note">
                New student? <a href="/register">Create a student account</a>
              </p>
            )}

            {isSuperAdminPortal ? (
              <p className="form-legal-note">
                Institute Admin or Student? <Link to="/login">Go to Portal Login</Link>
              </p>
            ) : (
              <p className="form-legal-note">
                Platform Admin? <Link to="/super-admin/login">Super Admin Login</Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
