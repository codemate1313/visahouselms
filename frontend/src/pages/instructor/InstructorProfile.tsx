import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { API_BASE_URL, apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import type { InstructorAccount } from "../../api/types";
import { ProfileEditorShell } from "../../components/ProfileEditorShell";
import { useAuthStore } from "../../store/authStore";

export function InstructorProfile() {
  const authUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [profile, setProfile] = useState<InstructorAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarRevision, setAvatarRevision] = useState(0);

  useEffect(() => {
    apiClient
      .get<InstructorAccount>("/instructor/me/profile")
      .then(({ data }) => setProfile(data))
      .catch(() => setError("Failed to load profile."));
  }, []);

  function update<K extends keyof InstructorAccount>(key: K, value: InstructorAccount[K]) {
    setProfile((current) => current ? { ...current, [key]: value } : current);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { data } = await apiClient.patch<InstructorAccount>("/instructor/me/profile", {
        email: profile.email,
        first_name: profile.first_name,
        last_name: profile.last_name,
        bio: profile.bio,
      });
      setProfile(data);
      const { data: freshUser } = await apiClient.get("/auth/me");
      setUser(freshUser);
      setSuccess("Profile updated.");
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to update profile."));
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await apiClient.post("/instructor/me/avatar", form);
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

  if (!profile && !error) return <p>Loading...</p>;
  if (!profile) return <p className="error-text">{error}</p>;

  const roleLabel = authUser?.role === "INST_INSTRUCTOR" ? "Institute Instructor" : "SA Instructor";
  const initials = `${authUser?.first_name?.[0] ?? ""}${authUser?.last_name?.[0] ?? ""}`.toUpperCase();
  const avatarSrc = authUser?.avatar_url ? `${API_BASE_URL}${authUser.avatar_url}?v=${avatarRevision}` : null;

  return (
    <ProfileEditorShell
      roleLabel={roleLabel}
      tone="instructor"
      firstName={profile.first_name}
      lastName={profile.last_name}
      email={profile.email}
      avatarSrc={avatarSrc}
      initials={initials}
      uploading={uploading}
      avatarInputId="instructor-avatar-input"
      onAvatarChange={uploadAvatar}
    >
      <form className="role-profile-form" onSubmit={save}>
        <div className="form-grid">
          <div>
            <label htmlFor="instructor-first-name">First name</label>
            <input id="instructor-first-name" value={profile.first_name} onChange={(event) => update("first_name", event.target.value)} required />
          </div>
          <div>
            <label htmlFor="instructor-last-name">Last name</label>
            <input id="instructor-last-name" value={profile.last_name} onChange={(event) => update("last_name", event.target.value)} required />
          </div>
        </div>
        <label htmlFor="instructor-email">Email address</label>
        <input id="instructor-email" type="email" value={profile.email} onChange={(event) => update("email", event.target.value)} required />

        <label htmlFor="instructor-title">Professional title</label>
        <input id="instructor-title" value={profile.title} readOnly className="readonly-field" />

        <label htmlFor="instructor-bio">Bio</label>
        <textarea id="instructor-bio" rows={5} maxLength={3000} value={profile.bio ?? ""} onChange={(event) => update("bio", event.target.value || null)} />

        {error && <p className="error-text">{error}</p>}
        {success && <p className="success-text">{success}</p>}

        <div className="form-actions">
          <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Profile"}</button>
        </div>
      </form>
    </ProfileEditorShell>
  );
}
