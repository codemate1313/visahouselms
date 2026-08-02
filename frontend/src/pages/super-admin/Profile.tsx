import { type ChangeEvent, type FormEvent, useState } from "react";
import { API_BASE_URL, apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { ProfileEditorShell } from "@/components/ProfileEditorShell";
import { fromDateInputValue, ProfileContactFields, toDateInputValue } from "@/components/ProfileContactFields";
import { RequiredMark } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { profileStrings as strings } from "./Profile.strings";

export function Profile() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [email, setEmail] = useState(user?.email ?? "");
  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [dob, setDob] = useState(toDateInputValue(user?.dob));
  const [gender, setGender] = useState(user?.gender ?? "");
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number ?? "");
  const [address, setAddress] = useState(user?.address ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarRevision, setAvatarRevision] = useState(0);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const { data } = await apiClient.patch("/super-admin/me/profile", {
        email,
        first_name: firstName,
        last_name: lastName,
        dob: fromDateInputValue(dob),
        gender: gender || null,
        phone_number: phoneNumber || null,
        address: address || null,
      });
      setUser(data);
      setSuccess(strings.notices.saved);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.save));
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
      const { data } = await apiClient.post("/super-admin/me/avatar", form);
      setUser(data);
      setAvatarRevision(Date.now());
      setSuccess(strings.notices.avatarUpdated);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.avatar));
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  const initials = `${user?.first_name?.[0] ?? ""}${user?.last_name?.[0] ?? ""}`.trim().toUpperCase() || "SA";
  const avatarSrc = user?.avatar_url
    ? `${API_BASE_URL}${user.avatar_url}?v=${avatarRevision}`
    : null;

  return (
    <ProfileEditorShell
      roleLabel={strings.roleLabel}
      tone="super-admin"
      firstName={firstName}
      lastName={lastName}
      email={email}
      avatarSrc={avatarSrc}
      initials={initials}
      uploading={uploading}
      avatarInputId="super-admin-avatar-input"
      onAvatarChange={handleAvatarChange}
    >
      <form className="role-profile-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div>
            <label htmlFor="super-admin-first-name">{strings.firstNameLabel}<RequiredMark /></label>
            <input id="super-admin-first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} required />
          </div>
          <div>
            <label htmlFor="super-admin-last-name">{strings.lastNameLabel}<RequiredMark /></label>
            <input id="super-admin-last-name" value={lastName} onChange={(event) => setLastName(event.target.value)} required />
          </div>
        </div>
        <label htmlFor="super-admin-email">{strings.emailLabel}<RequiredMark /></label>
        <input id="super-admin-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />

        <ProfileContactFields
          idPrefix="super-admin"
          dob={dob}
          onDobChange={setDob}
          gender={gender}
          onGenderChange={setGender}
          phoneNumber={phoneNumber}
          onPhoneNumberChange={setPhoneNumber}
          address={address}
          onAddressChange={setAddress}
        />

        {error && <p className="error-text">{error}</p>}
        {success && <p className="success-text">{success}</p>}

        <div className="form-actions">
          <button type="submit" disabled={saving}>{saving ? strings.saving : strings.saveProfile}</button>
        </div>
      </form>
    </ProfileEditorShell>
  );
}
