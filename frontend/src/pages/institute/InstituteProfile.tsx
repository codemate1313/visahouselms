import { type ChangeEvent, type FormEvent, useState } from "react";
import { API_BASE_URL, apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import { useAuthStore } from "../../store/authStore";

export function InstituteProfile() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [form, setForm] = useState({ email: user?.email ?? "", first_name: user?.first_name ?? "", last_name: user?.last_name ?? "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(null); setSuccess(null);
    try { const { data } = await apiClient.patch("/institute/me/profile", form); setUser(data); setSuccess("Profile updated."); }
    catch (err: unknown) { setError(extractErrorMessage(err, "Failed to update profile.")); }
    finally { setSaving(false); }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    setUploading(true); setError(null); setSuccess(null);
    try { const body = new FormData(); body.append("file", file); const { data } = await apiClient.post("/institute/me/avatar", body); setUser(data); setSuccess("Avatar updated."); }
    catch (err: unknown) { setError(extractErrorMessage(err, "Failed to upload avatar.")); }
    finally { setUploading(false); event.target.value = ""; }
  }

  const initials = `${user?.first_name?.[0] ?? ""}${user?.last_name?.[0] ?? ""}`.toUpperCase();
  const avatar = user?.avatar_url ? `${API_BASE_URL}${user.avatar_url}?t=${Date.now()}` : null;

  return <div><h1>My Profile</h1><div className="profile-avatar-row">{avatar ? <img src={avatar} alt="Avatar" className="avatar-preview" /> : <div className="avatar-preview avatar-initials">{initials}</div>}<div><label htmlFor="avatar-input" className="avatar-upload-label">{uploading ? "Uploading..." : "Change avatar"}</label><input id="avatar-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} disabled={uploading} hidden /><p className="hint">PNG, JPEG, or WebP. Max 2 MB.</p></div></div><form className="form-card" onSubmit={submit}><label htmlFor="email">Email</label><input id="email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /><label htmlFor="first_name">First name</label><input id="first_name" value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} required /><label htmlFor="last_name">Last name</label><input id="last_name" value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} required />{error && <p className="error-text">{error}</p>}{success && <p className="success-text">{success}</p>}<div className="form-actions"><button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Profile"}</button></div></form></div>;
}

