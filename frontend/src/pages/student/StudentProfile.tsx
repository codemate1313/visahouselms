import { type ChangeEvent, type FormEvent, useState } from "react";
import { API_BASE_URL, apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import { useAuthStore } from "../../store/authStore";

export function StudentProfile() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [email, setEmail] = useState(user?.email ?? "");
  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const { data } = await apiClient.patch("/student/me/profile", {
        email,
        first_name: firstName,
        last_name: lastName,
      });
      setUser(data);
      setSuccess("Profile updated.");
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to update profile."));
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setSuccess(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await apiClient.post("/student/me/avatar", form);
      setUser(data);
      setSuccess("Avatar updated.");
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to upload avatar."));
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  const initials = `${user?.first_name?.[0] ?? ""}${user?.last_name?.[0] ?? ""}`.toUpperCase();
  const avatarSrc = user?.avatar_url ? `${API_BASE_URL}${user.avatar_url}?t=${Date.now()}` : null;

  return (
    <div>
      <h1>My Profile</h1>

      <div className="profile-avatar-row">
        {avatarSrc ? (
          <img src={avatarSrc} alt="Avatar" className="avatar-preview" />
        ) : (
          <div className="avatar-preview avatar-initials">{initials || "?"}</div>
        )}
        <div>
          <label htmlFor="avatar-input" className="avatar-upload-label">
            {uploading ? "Uploading..." : "Change avatar"}
          </label>
          <input
            id="avatar-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleAvatarChange}
            disabled={uploading}
            hidden
          />
          <p className="hint">PNG, JPEG, or WebP. Max 2 MB.</p>
        </div>
      </div>

      <form className="form-card" onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />

        <label htmlFor="first_name">First name</label>
        <input id="first_name" value={firstName} onChange={(event) => setFirstName(event.target.value)} required />

        <label htmlFor="last_name">Last name</label>
        <input id="last_name" value={lastName} onChange={(event) => setLastName(event.target.value)} required />

        {error && <p className="error-text">{error}</p>}
        {success && <p className="success-text">{success}</p>}

        <div className="form-actions">
          <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Profile"}</button>
        </div>
      </form>
    </div>
  );
}
