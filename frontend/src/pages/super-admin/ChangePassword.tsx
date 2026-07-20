import { type FormEvent, useState } from "react";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import { PasswordInput } from "../../components/PasswordInput";
import { PasswordStrengthMeter } from "../../components/PasswordStrengthMeter";
import { useAuthStore } from "../../store/authStore";
import { evaluatePassword } from "../../utils/passwordStrength";

interface ChangePasswordProps {
  apiBase?: string;
}

export function ChangePassword({ apiBase = "/super-admin" }: ChangePasswordProps) {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const strength = evaluatePassword(newPassword);
  const confirmMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setSaving(true);
    try {
      await apiClient.post(`${apiBase}/me/change-password`, {
        current_password: currentPassword,
        new_password: newPassword,
      });
      const { data: freshUser } = await apiClient.get("/auth/me");
      setUser(freshUser);
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to change password."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1>Change Password</h1>

      {user?.force_password_reset && (
        <div className="banner warning">
          An administrator requires you to change your password before continuing.
        </div>
      )}

      <form className="form-card" onSubmit={handleSubmit}>
        <label htmlFor="current_password">Current password</label>
        <PasswordInput
          id="current_password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
        />

        <label htmlFor="new_password">New password</label>
        <PasswordInput
          id="new_password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
        />
        <PasswordStrengthMeter password={newPassword} />

        <label htmlFor="confirm_password">Confirm new password</label>
        <PasswordInput
          id="confirm_password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />
        {confirmMismatch && <p className="error-text">Passwords do not match.</p>}

        {error && <p className="error-text">{error}</p>}
        {success && <p className="success-text">Password updated successfully.</p>}

        <div className="form-actions">
          <button type="submit" disabled={saving || !strength.allMet || confirmMismatch}>
            {saving ? "Saving..." : "Update Password"}
          </button>
        </div>
      </form>
    </div>
  );
}
