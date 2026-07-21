import { type FormEvent, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import { PasswordInput } from "../components/PasswordInput";
import { useAuthStore } from "../store/authStore";
import { useToastStore } from "../store/toastStore";

interface LoginProps {
  allowedRoles?: string[];
  title?: string;
  subtitle?: string;
  wrongRoleMessage?: string;
}

function destinationFor(user: { role: string; force_password_reset: boolean }) {
  if (user.role === "SUPER_ADMIN") return user.force_password_reset ? "/super-admin/change-password" : "/super-admin/dashboard";
  if (user.role === "SA_INSTRUCTOR") return user.force_password_reset ? "/super-admin/instructor/change-password" : "/super-admin/instructor/dashboard";
  if (user.role === "INSTITUTE_ADMIN") return "/institute-portal";
  if (user.role === "STUDENT") return "/student/dashboard";
  return null;
}

export function Login({
  allowedRoles,
  title = "IELTS LMS",
  subtitle = "Enter your credentials to access your dashboard",
  wrongRoleMessage = "Use the correct login page for this account.",
}: LoginProps) {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data: tokens } = await apiClient.post("/auth/login", {
        email: email.trim().toLowerCase(),
        password,
      });
      const { data: user } = await apiClient.get("/auth/me", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (allowedRoles && !allowedRoles.includes(user.role)) {
        setError(wrongRoleMessage);
        showError(wrongRoleMessage, "Access Denied");
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

  return (
    <div className="login-concise-page">
      <div className="login-concise-card">
        {/* Left Side: Crisp 3D Image Panel */}
        <div className="login-graphic-side">
          <div className="graphic-overlay">
            <span className="graphic-badge">IELTS LMS PLATFORM</span>
            <h2 className="graphic-heading">Smart Evaluation & Institute Analytics</h2>
          </div>
          <img
            src="/assets/login-showcase.png"
            alt="IELTS LMS Platform"
            className="graphic-img"
          />
        </div>

        {/* Right Side: Concise Professional Form with Centered Header */}
        <div className="login-form-side">
          <div className="login-form-header text-center">
            <div className="brand-logo-badge justify-center">
              <span className="logo-dot" />
              <span>{title}</span>
            </div>
            <h1 className="form-main-title">Sign in</h1>
            <p className="form-sub-title">{subtitle}</p>
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

            {/* Sleek Custom Toggle Switch for Remember Me */}
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

          {allowedRoles?.includes("STUDENT") && (
            <p className="form-legal-note text-center">
              New here? <a href="/register">Create a student account</a>
            </p>
          )}

          <p className="form-legal-note text-center">
            Protected by enterprise encryption. <a href="#privacy">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
