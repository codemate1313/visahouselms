import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import { PasswordInput } from "../../components/PasswordInput";
import { PasswordStrengthMeter } from "../../components/PasswordStrengthMeter";
import { evaluatePassword } from "../../utils/passwordStrength";

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
      .catch(() => setError("Failed to load account."))
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
      setError(extractErrorMessage(err, "Failed to upload image."));
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
      setError(extractErrorMessage(err, "Failed to save account."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Loading...</p>;

  const fullName = `${firstName} ${lastName}`.trim();
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() || "SA";

  return (
    <div className="account-editor-page">
      <div className="page-header account-editor-header">
        <div>
          <span className="section-kicker">Super Admin Access</span>
          <h1>{isNew ? "New Super Admin Account" : "Edit Super Admin Account"}</h1>
          <p className="page-subtitle">Manage identity, contact details, and account security from one clean workspace.</p>
        </div>
      </div>

      <form className="account-editor-shell" onSubmit={handleSubmit}>
        <aside className="account-profile-panel">
          <div className="account-avatar-preview">
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar preview" />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <div className="account-profile-copy">
            <span className="phase-chip">{isNew ? "New profile" : "Profile image"}</span>
            <h2>{fullName || "Super Admin"}</h2>
            <p>{email || "Add an email address to complete this account."}</p>
          </div>
          <div className="account-upload-box">
            <strong>Profile Image</strong>
            <input
              id="avatar-file-upload"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={uploadingAvatar}
              hidden
            />
            <label className="avatar-upload-cta" htmlFor="avatar-file-upload">
              {uploadingAvatar ? "Uploading..." : "Choose Image"}
            </label>
            <span>{avatarFileName || "PNG, JPG, or WebP from your system."}</span>
          </div>
        </aside>

        <section className="account-form-panel">
          <div className="account-form-section">
            <div className="section-heading compact">
              <div>
                <h2>Personal Details</h2>
                <p>Keep the account profile easy to identify across admin tools.</p>
              </div>
            </div>
            <div className="account-field-grid">
              <div>
                <label htmlFor="first_name">First name</label>
                <input
                  id="first_name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  required
                />
              </div>

              <div>
                <label htmlFor="last_name">Last name</label>
                <input
                  id="last_name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  required
                />
              </div>

              <div className="field-wide">
                <label htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {isNew && (
            <div className="account-form-section">
              <div className="section-heading compact">
                <div>
                  <h2>Security</h2>
                  <p>Create a strong temporary password for the first sign-in.</p>
                </div>
              </div>
              <label htmlFor="password">Password</label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <PasswordStrengthMeter password={password} />
            </div>
          )}

          <div className="account-form-section">
            <div className="section-heading compact">
              <div>
                <h2>Contact Info</h2>
                <p>Optional details for internal records and support handoffs.</p>
              </div>
            </div>
            <div className="account-field-grid">
              <div>
                <label htmlFor="dob">Date of Birth (DOB)</label>
                <input
                  id="dob"
                  type="date"
                  value={dob}
                  onChange={(event) => setDob(event.target.value)}
                />
              </div>

              <div>
                <label htmlFor="phone">Phone Number</label>
                <input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                />
              </div>

              <div className="field-wide">
                <label htmlFor="address">Address</label>
                <input
                  id="address"
                  type="text"
                  placeholder="123 Main Street, Suite 100"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                />
              </div>
            </div>
          </div>

          {error && <p className="error-text">{error}</p>}

          <div className="form-actions account-editor-actions">
            <button
              type="submit"
              disabled={saving || uploadingAvatar || (isNew && !evaluatePassword(password).allMet)}
            >
              {saving ? "Saving..." : "Save Account"}
            </button>
            <button type="button" onClick={() => navigate("/super-admin/accounts")}>
              Cancel
            </button>
          </div>
        </section>
      </form>
    </div>
  );
}
