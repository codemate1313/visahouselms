import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { API_BASE_URL, apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import type { InstructorAccount } from "../../api/types";
import { useAuthStore } from "../../store/authStore";

const SPECIALIZATIONS = ["Listening", "Reading", "Writing", "Speaking", "Test design"];

export function InstructorProfile() {
  const authUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [profile, setProfile] = useState<InstructorAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { apiClient.get<InstructorAccount>("/instructor/me/profile").then(({ data }) => setProfile(data)).catch(() => setError("Failed to load profile.")); }, []);

  function update<K extends keyof InstructorAccount>(key: K, value: InstructorAccount[K]) {
    setProfile((current) => current ? { ...current, [key]: value } : current);
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!profile) return;
    setSaving(true); setError(null); setSuccess(null);
    try {
      const { data } = await apiClient.patch<InstructorAccount>("/instructor/me/profile", {
        email: profile.email, first_name: profile.first_name, last_name: profile.last_name,
        bio: profile.bio,
      });
      setProfile(data);
      const { data: freshUser } = await apiClient.get("/auth/me");
      setUser(freshUser); setSuccess("Profile updated.");
    } catch (err: unknown) { setError(extractErrorMessage(err, "Failed to update profile.")); }
    finally { setSaving(false); }
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    setUploading(true); setError(null); setSuccess(null);
    try {
      const form = new FormData(); form.append("file", file);
      const { data } = await apiClient.post("/instructor/me/avatar", form);
      setUser(data); setSuccess("Avatar updated.");
    } catch (err: unknown) { setError(extractErrorMessage(err, "Failed to upload avatar.")); }
    finally { setUploading(false); event.target.value = ""; }
  }

  if (!profile && !error) return <p>Loading...</p>;
  if (!profile) return <p className="error-text">{error}</p>;
  const initials = `${authUser?.first_name?.[0] ?? ""}${authUser?.last_name?.[0] ?? ""}`.toUpperCase();
  const avatarSrc = authUser?.avatar_url ? `${API_BASE_URL}${authUser.avatar_url}?t=${Date.now()}` : null;
  const assignedSpecializations = SPECIALIZATIONS.filter((item) => profile.specializations.includes(item));
  return <div><h1>My Profile</h1><div className="profile-avatar-row">{avatarSrc ? <img src={avatarSrc} alt="Avatar" className="avatar-preview" /> : <div className="avatar-preview avatar-initials">{initials || "?"}</div>}<div><label htmlFor="instructor-avatar" className="avatar-upload-label">{uploading ? "Uploading..." : "Change avatar"}</label><input id="instructor-avatar" type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadAvatar} disabled={uploading} hidden /><p className="hint">PNG, JPEG, or WebP. Max 2 MB.</p></div></div><form className="form-card wide" onSubmit={save}><div className="form-grid"><div><label htmlFor="first_name">First name</label><input id="first_name" value={profile.first_name} onChange={(e) => update("first_name", e.target.value)} required /></div><div><label htmlFor="last_name">Last name</label><input id="last_name" value={profile.last_name} onChange={(e) => update("last_name", e.target.value)} required /></div></div><label htmlFor="email">Email</label><input id="email" type="email" value={profile.email} onChange={(e) => update("email", e.target.value)} required /><label htmlFor="title">Professional title</label><input id="title" value={profile.title} readOnly className="readonly-field" /><label>Specializations</label><div className="assigned-specializations">{assignedSpecializations.length ? assignedSpecializations.map((item) => <span className="assigned-specialization" key={item}>{item}</span>) : <span className="muted-text">No specializations assigned</span>}</div><label htmlFor="bio">Bio</label><textarea id="bio" rows={5} maxLength={3000} value={profile.bio ?? ""} onChange={(e) => update("bio", e.target.value || null)} />{error && <p className="error-text">{error}</p>}{success && <p className="success-text">{success}</p>}<div className="form-actions"><button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Profile"}</button></div></form></div>;
}
