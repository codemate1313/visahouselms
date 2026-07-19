import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import { useAuthStore } from "../store/authStore";

export function Login() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data: tokens } = await apiClient.post("/auth/login", { email, password });
      const { data: user } = await apiClient.get("/auth/me", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      setSession(tokens.access_token, tokens.refresh_token, user);
      navigate(user.force_password_reset ? "/super-admin/change-password" : "/super-admin");
    } catch {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>IELTS LMS</h1>
        <p className="auth-subtitle">Sign in to your account</p>

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        {error && <p className="error-text">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
