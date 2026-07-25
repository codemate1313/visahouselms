import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { evaluatePassword } from "@/utils/passwordStrength";
import { accountFormStrings as strings } from "./AccountForm.strings";
import { AvatarPanel } from "./components/AvatarPanel";
import { PersonalDetailsPanel } from "./components/PersonalDetailsPanel";
import { SecurityPanel } from "./components/SecurityPanel";
import { ContactInfoPanel } from "./components/ContactInfoPanel";

export function AccountForm() {
  const { id } = useParams();
  const isNew = id === "new" || id === undefined;
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [address, setAddress] = useState("");
  const [avatarPath, setAvatarPath] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarFileName, setAvatarFileName] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) return;
    apiClient
      .get(`/super-admin/accounts/${id}`)
      .then(({ data }) => {
        setEmail(data.email ?? "");
        setFirstName(data.first_name ?? "");
        setLastName(data.last_name ?? "");
        setDob(data.dob ? data.dob.split("T")[0] : "");
        setPhoneNumber(data.phone_number ?? "");
        setAddress(data.address ?? "");
        if (data.avatar_path) {
          setAvatarPath(data.avatar_path);
          setAvatarPreview(`/storage/${data.avatar_path}`);
        }
      })
      .catch(() => setError(strings.errors.load))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const localUrl = URL.createObjectURL(file);
    setAvatarPreview(localUrl);
    setAvatarFileName(file.name);
    setUploadingAvatar(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await apiClient.post("/super-admin/upload-avatar", formData);
      setAvatarPath(data.avatar_path);
      setAvatarPreview(data.url);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.uploadImage));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        email,
        first_name: firstName,
        last_name: lastName,
        dob: dob ? new Date(dob).toISOString() : null,
        phone_number: phoneNumber || null,
        address: address || null,
        avatar_path: avatarPath || null,
        ...(isNew ? { password } : {}),
      };

      if (isNew) {
        await apiClient.post("/super-admin/accounts", payload);
      } else {
        await apiClient.patch(`/super-admin/accounts/${id}`, payload);
      }
      navigate("/super-admin/accounts");
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.save));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>{strings.loading}</p>;

  const fullName = `${firstName} ${lastName}`.trim();
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() || "SA";

  return (
    <div className="account-editor-page">
      <div className="page-header account-editor-header">
        <div>
          <span className="section-kicker">{strings.kicker}</span>
          <h1>{isNew ? strings.newTitle : strings.editTitle}</h1>
          <p className="page-subtitle">{strings.subtitle}</p>
        </div>
      </div>

      <form className="account-editor-shell" onSubmit={handleSubmit}>
        <AvatarPanel
          isNew={isNew}
          avatarPreview={avatarPreview}
          fullName={fullName}
          email={email}
          initials={initials}
          avatarFileName={avatarFileName}
          uploadingAvatar={uploadingAvatar}
          onFileChange={handleFileChange}
        />

        <section className="account-form-panel">
          <PersonalDetailsPanel
            firstName={firstName}
            onFirstNameChange={setFirstName}
            lastName={lastName}
            onLastNameChange={setLastName}
            email={email}
            onEmailChange={setEmail}
          />

          {isNew && <SecurityPanel password={password} onPasswordChange={setPassword} />}

          <ContactInfoPanel
            dob={dob}
            onDobChange={setDob}
            phoneNumber={phoneNumber}
            onPhoneNumberChange={setPhoneNumber}
            address={address}
            onAddressChange={setAddress}
          />

          {error && <p className="error-text">{error}</p>}

          <div className="form-actions account-editor-actions">
            <button
              type="submit"
              disabled={saving || uploadingAvatar || (isNew && !evaluatePassword(password).allMet)}
            >
              {saving ? strings.saving : strings.saveAccount}
            </button>
            <button type="button" onClick={() => navigate("/super-admin/accounts")}>
              {strings.cancel}
            </button>
          </div>
        </section>
      </form>
    </div>
  );
}
