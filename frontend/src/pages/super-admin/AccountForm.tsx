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

  return (
    <div>
      <h1>{isNew ? "New Super Admin Account" : "Edit Super Admin Account"}</h1>
      <form className="form-card" onSubmit={handleSubmit}>
        {/* Profile Picture File Upload Picker */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px" }}>
          <div style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            backgroundColor: "#fee2e2",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            border: "2px solid #fca5a5",
            flexShrink: 0,
          }}>
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: "24px" }}>👤</span>
            )}
          </div>
          <div>
            <label htmlFor="avatar-file-upload" style={{ fontWeight: 600, display: "block", marginBottom: "6px" }}>
              Profile Image (Upload from system)
            </label>
            <input
              id="avatar-file-upload"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={uploadingAvatar}
            />
            {uploadingAvatar && (
              <span className="hint" style={{ color: "#dc2626", marginLeft: "8px" }}>
                Uploading image...
              </span>
            )}
          </div>
        </div>

        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
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
        </div>

        <label htmlFor="email" style={{ marginTop: "12px" }}>Email address</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        {isNew && (
          <>
            <label htmlFor="password">Password</label>
            <PasswordInput
              id="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <PasswordStrengthMeter password={password} />
          </>
        )}

        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "12px" }}>
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
        </div>

        <label htmlFor="address" style={{ marginTop: "12px" }}>Address</label>
        <input
          id="address"
          type="text"
          placeholder="123 Main Street, Suite 100"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
        />

        {error && <p className="error-text">{error}</p>}

        <div className="form-actions" style={{ marginTop: "20px" }}>
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
      </form>
    </div>
  );
}
