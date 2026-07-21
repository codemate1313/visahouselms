import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import { getDeviceIdentity } from "../auth/device";
import { extractErrorMessage } from "../api/errors";
import { PasswordInput } from "../components/PasswordInput";
import { PasswordStrengthMeter } from "../components/PasswordStrengthMeter";
import { useAuthStore } from "../store/authStore";
import { useToastStore } from "../store/toastStore";

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
      setSession(tokens.access_token, tokens.refresh_token, user);
      showSuccess("Your account is ready.", "Welcome");
      navigate("/student/dashboard");
    } catch (requestError: unknown) {
      const msg = extractErrorMessage(requestError, "Unable to create your account. Please try again.");
      setError(msg);
      showError(msg, "Sign Up Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-concise-page">
      <div className="login-concise-card">
        <div className="login-graphic-side">
          <div className="graphic-overlay">
            <span className="graphic-badge">IELTS LMS PLATFORM</span>
            <h2 className="graphic-heading">Start Your IELTS Journey Today</h2>
          </div>
          <img src="/assets/login-showcase.png" alt="IELTS LMS Platform" className="graphic-img" />
        </div>

        <div className="login-form-side">
          <div className="login-form-header text-center">
            <div className="brand-logo-badge justify-center">
              <span className="logo-dot" />
              <span>IELTS LMS</span>
            </div>
            <h1 className="form-main-title">Create your account</h1>
            <p className="form-sub-title">Sign up as a direct student to browse and purchase courses.</p>
          </div>

          <form onSubmit={handleSubmit} className="concise-form">
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="first_name">First name</label>
                <input
                  id="first_name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  required
                  maxLength={100}
                  autoComplete="given-name"
                />
              </div>
              <div className="form-group">
                <label htmlFor="last_name">Last name</label>
                <input
                  id="last_name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  required
                  maxLength={100}
                  autoComplete="family-name"
                />
              </div>
            </div>

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
                placeholder="Create a password"
                autoComplete="new-password"
              />
              <PasswordStrengthMeter password={password} />
            </div>

            {error && <div className="concise-error-box">{error}</div>}

            <button type="submit" className="concise-submit-btn" disabled={loading}>
              {loading ? "Creating account..." : "Create account →"}
            </button>
          </form>

          <p className="form-legal-note text-center">
            Already have an account? <a href="/login">Sign in</a>
          </p>
        </div>
      </div>
    </div>
  );
}
