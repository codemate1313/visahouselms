import { type FormEvent, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import { useAuthStore } from "../store/authStore";

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
  return null;
}

export function Login({
  allowedRoles,
  title = "IELTS LMS",
  subtitle = "Sign in to your account",
  wrongRoleMessage = "Use the correct login page for this account.",
}: LoginProps) {
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
      const { data: tokens } = await apiClient.post("/auth/login", {
        email: email.trim().toLowerCase(),
        password,
      });
      const { data: user } = await apiClient.get("/auth/me", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (allowedRoles && !allowedRoles.includes(user.role)) {
        setError(wrongRoleMessage);
        return;
      }
      const destination = destinationFor(user);
      if (!destination) {
        setError("This role does not have a portal yet.");
        return;
      }
      setSession(tokens.access_token, tokens.refresh_token, user);
      navigate(destination);
    } catch (requestError: unknown) {
      if (axios.isAxiosError(requestError)) {
        const detail = requestError.response?.data?.detail;
        setError(typeof detail === "string" ? detail : "Unable to connect to the login service.");
      } else {
        setError("Unable to sign in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>{title}</h1>
        <p className="auth-subtitle">{subtitle}</p>

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
