import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { PasswordInput } from "@/components/PasswordInput";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";
import { Button, RequiredMark } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { evaluatePassword } from "@/utils/passwordStrength";
import { destinationFor } from "@/pages/Login/helpers";
import { changePasswordStrings as strings } from "./ChangePassword.strings";

interface ChangePasswordProps {
  apiBase?: string;
}

export function ChangePassword({ apiBase = "/super-admin" }: ChangePasswordProps) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const isFirstLoginPasswordSetup = Boolean(user?.force_password_reset);
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
      setError(strings.errors.mismatch);
      return;
    }

    setSaving(true);
    try {
      await apiClient.post(`${apiBase}/me/change-password`, isFirstLoginPasswordSetup
        ? { new_password: newPassword }
        : {
            current_password: currentPassword,
            new_password: newPassword,
      });
      const { data: freshUser } = await apiClient.get("/auth/me");
      setUser(freshUser);
      if (isFirstLoginPasswordSetup) {
        const destination = destinationFor(freshUser);
        navigate(destination ?? "/", { replace: true });
        return;
      }
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.save));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="change-password-page">
      <h1>{strings.title}</h1>

      {isFirstLoginPasswordSetup && (
        <div className="banner warning">
          {strings.forceResetBanner}
        </div>
      )}

      <form className="form-card" onSubmit={handleSubmit}>
        {!isFirstLoginPasswordSetup && (
          <>
            <label htmlFor="current_password">{strings.currentPasswordLabel}<RequiredMark /></label>
            <PasswordInput
              id="current_password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </>
        )}

        <label htmlFor="new_password">{strings.newPasswordLabel}<RequiredMark /></label>
        <PasswordInput
          id="new_password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
        />
        <PasswordStrengthMeter password={newPassword} />

        <label htmlFor="confirm_password">{strings.confirmPasswordLabel}<RequiredMark /></label>
        <PasswordInput
          id="confirm_password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />
        {confirmMismatch && <p className="error-text">{strings.mismatch}</p>}

        {error && <p className="error-text">{error}</p>}
        {success && <p className="success-text">{strings.notices.saved}</p>}

        <div className="form-actions">
          <Button
            type="submit"
            variant="primary"
            loading={saving}
            disabled={saving || !strength.allMet || confirmMismatch || (!isFirstLoginPasswordSetup && !currentPassword)}
          >
            {saving ? strings.saving : strings.updatePassword}
          </Button>
        </div>
      </form>
    </div>
  );
}
