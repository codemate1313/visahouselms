import { type ChangeEvent, type FormEvent, useState } from "react";
import { API_BASE_URL, apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { fromDateInputValue, toDateInputValue } from "@/components/profileContactFieldsUtils";
import { ProfileContactFields } from "@/components/ProfileContactFields";
import { ProfileEditorShell } from "@/components/ProfileEditorShell";
import { RequiredMark } from "@/components/ui";
import { Button } from "@/components/ui/Button/Button";
import { noChangesMessage } from "@/content/common.strings";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { isEqual } from "@/utils/isEqual";
import { instituteProfileStrings as strings } from "./InstituteProfile.strings";

export function InstituteProfile() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const showInfo = useToastStore((state) => state.showInfo);
  const [form, setForm] = useState({
    email: user?.email ?? "",
    first_name: user?.first_name ?? "",
    last_name: user?.last_name ?? "",
  });
  const [dob, setDob] = useState(toDateInputValue(user?.dob));
  const [gender, setGender] = useState(user?.gender ?? "");
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number ?? "");
  const [address, setAddress] = useState(user?.address ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarRevision, setAvatarRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const original = {
      email: user?.email ?? "",
      first_name: user?.first_name ?? "",
      last_name: user?.last_name ?? "",
      dob: toDateInputValue(user?.dob),
      gender: user?.gender || null,
      phone_number: user?.phone_number || null,
      address: user?.address || null,
    };
    const next = {
      ...form,
      dob,
      gender: gender || null,
      phone_number: phoneNumber || null,
      address: address || null,
    };
    if (isEqual(original, next)) {
      showInfo(noChangesMessage);
      return;
    }

    setSaving(true);
    try {
      const { data } = await apiClient.patch("/institute/me/profile", {
        ...form,
        dob: fromDateInputValue(dob),
        gender: gender || null,
        phone_number: phoneNumber || null,
        address: address || null,
      });
      setUser(data);
      setSuccess(strings.success.profileUpdated);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.updateProfile));
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
      setSuccess(strings.success.avatarUpdated);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.uploadAvatar));
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  const initials = `${user?.first_name?.[0] ?? ""}${user?.last_name?.[0] ?? ""}`.trim().toUpperCase() || "IA";
  const avatar = user?.avatar_url ? `${API_BASE_URL}${user.avatar_url}?v=${avatarRevision}` : null;

  return (
    <ProfileEditorShell
      roleLabel={strings.roleLabel}
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
            <label htmlFor="institute-first-name">{strings.firstName}<RequiredMark /></label>
            <input id="institute-first-name" value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} required />
          </div>
          <div>
            <label htmlFor="institute-last-name">{strings.lastName}<RequiredMark /></label>
            <input id="institute-last-name" value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} required />
          </div>
        </div>
        <label htmlFor="institute-email">{strings.emailAddress}<RequiredMark /></label>
        <input id="institute-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />

        <ProfileContactFields
          idPrefix="institute-admin"
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
          <Button type="submit" disabled={saving}>{saving ? strings.saving : strings.save}</Button>
        </div>
      </form>
    </ProfileEditorShell>
  );
}
