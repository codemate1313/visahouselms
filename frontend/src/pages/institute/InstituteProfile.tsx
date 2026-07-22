import { type ChangeEvent, type FormEvent, useState } from "react";
import { API_BASE_URL, apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import { ProfileEditorShell } from "../../components/ProfileEditorShell";
import { useAuthStore } from "../../store/authStore";

export function InstituteProfile() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [form, setForm] = useState({
    email: user?.email ?? "",
    first_name: user?.first_name ?? "",
    last_name: user?.last_name ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarRevision, setAvatarRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { data } = await apiClient.patch("/institute/me/profile", form);
      setUser(data);
      setSuccess("Profile updated.");
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to update profile."));
    } finally {
      setSaving(false);
    }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const { data } = await apiClient.post("/institute/me/avatar", body);
      setUser(data);
      setAvatarRevision(Date.now());
      setSuccess("Avatar updated.");
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to upload avatar."));
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  const initials = `${user?.first_name?.[0] ?? ""}${user?.last_name?.[0] ?? ""}`.toUpperCase();
  const avatar = user?.avatar_url ? `${API_BASE_URL}${user.avatar_url}?v=${avatarRevision}` : null;

  return (
    <ProfileEditorShell
      roleLabel="Institute Admin"
      tone="institute"
      firstName={form.first_name}
      lastName={form.last_name}
      email={form.email}
      avatarSrc={avatar}
      initials={initials}
      uploading={uploading}
      avatarInputId="institute-avatar-input"
      onAvatarChange={upload}
    >
      <form className="role-profile-form" onSubmit={submit}>
        <div className="form-grid">
          <div>
            <label htmlFor="institute-first-name">First name</label>
            <input id="institute-first-name" value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} required />
          </div>
          <div>
            <label htmlFor="institute-last-name">Last name</label>
            <input id="institute-last-name" value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} required />
          </div>
        </div>
        <label htmlFor="institute-email">Email address</label>
        <input id="institute-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />

        {error && <p className="error-text">{error}</p>}
        {success && <p className="success-text">{success}</p>}

        <div className="form-actions">
          <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Profile"}</button>
        </div>
      </form>
    </ProfileEditorShell>
  );
}
