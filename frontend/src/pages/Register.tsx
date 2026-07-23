import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import { getDeviceIdentity } from "../auth/device";
import { extractErrorMessage } from "../api/errors";
import { PasswordInput } from "../components/PasswordInput";
import { PasswordStrengthMeter } from "../components/PasswordStrengthMeter";
import { useAuthStore } from "../store/authStore";
import { useToastStore } from "../store/toastStore";
import { HeroSlider } from "./Login";

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
            <h1 className="form-main-title">CREATE ACCOUNT</h1>
            <p className="form-sub-title">Sign up as a student to browse and access IELTS courses.</p>
          </div>

          <form onSubmit={handleSubmit} className="concise-form">
            <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div className="form-group">
                <label htmlFor="first_name">First name</label>
                <input
                  id="first_name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  placeholder="First name"
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
                  placeholder="Last name"
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

          <div className="login-footer-links text-center">
            <p className="form-legal-note">
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
