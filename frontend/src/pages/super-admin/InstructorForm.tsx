import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import type { InstructorAccount, InstructorAccountCreated } from "../../api/types";

function extractTemporaryPassword(data: InstructorAccountCreated): string {
  const response = data as InstructorAccountCreated & {
    temp_password?: string;
    temporaryPassword?: string;
  };
  return response.temporary_password || response.temp_password || response.temporaryPassword || "";
}

export function InstructorForm() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("IELTS Instructor");
  const [bio, setBio] = useState("");
  const [dob, setDob] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [address, setAddress] = useState("");
  const [avatarPath, setAvatarPath] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [created, setCreated] = useState<InstructorAccountCreated | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isNew) return;
    apiClient.get<InstructorAccount>(`/super-admin/instructors/${id}`)
      .then(({ data }) => {
        setEmail(data.email ?? "");
        setFirstName(data.first_name ?? "");
        setLastName(data.last_name ?? "");
        setTitle(data.title ?? "IELTS Instructor");
        setBio(data.bio ?? "");
        setDob(data.dob ? data.dob.split("T")[0] : "");
        setPhoneNumber(data.phone_number ?? "");
        setAddress(data.address ?? "");
        if (data.avatar_path) {
          setAvatarPath(data.avatar_path);
          setAvatarPreview(`/storage/${data.avatar_path}`);
        }
      })
      .catch(() => setError("Failed to load instructor."))
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
    setSaving(true);
    setError(null);
    const payload = {
      email,
      first_name: firstName,
      last_name: lastName,
      title,
      bio: bio || null,
      dob: dob ? new Date(dob).toISOString() : null,
      phone_number: phoneNumber || null,
      address: address || null,
      avatar_path: avatarPath || null,
    };

    try {
      if (isNew) {
        const { data } = await apiClient.post<InstructorAccountCreated>("/super-admin/instructors", payload);
        setCreated(data);
        setCopied(false);
      } else {
        await apiClient.patch(`/super-admin/instructors/${id}`, payload);
        navigate("/super-admin/instructors");
      }
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to save instructor."));
    } finally {
      setSaving(false);
    }
  }

  async function copyPassword() {
    if (!created) return;
    const temporaryPassword = extractTemporaryPassword(created);
    if (!temporaryPassword) {
      setError("Temporary password was not returned by the server. Restart the backend and reset the instructor password.");
      return;
    }
    await navigator.clipboard.writeText(temporaryPassword);
    setCopied(true);
  }

  if (loading) return <p>Loading...</p>;
  const createdPassword = created ? extractTemporaryPassword(created) : "";
  if (created) return (
    <div>
      <h1>Instructor Created</h1>
      <div className="credential-card standalone">
        <div>
          <strong>Temporary Login Credentials</strong>
          <p>{created.email}</p>
          {createdPassword ? <code>{createdPassword}</code> : <p className="error-text">Temporary password was not returned. Restart the backend, then use Reset Password from the instructor list.</p>}
          <p className="hint">Share this password with the instructor for testing. They will be asked to change it after login.</p>
          {error && <p className="error-text">{error}</p>}
        </div>
        <div className="credential-actions">
          <button className="secondary-button" onClick={copyPassword}>{copied ? "Copied" : "Copy Password"}</button>
          <button className="secondary-button" onClick={() => navigate("/super-admin/instructors")}>Done</button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <h1>{isNew ? "New SA Instructor" : "Edit SA Instructor"}</h1>
      <form className="form-card wide" onSubmit={handleSubmit}>
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
              <span style={{ fontSize: "24px" }}>👨‍🏫</span>
            )}
          </div>
          <div>
            <label htmlFor="instructor-avatar-upload" style={{ fontWeight: 600, display: "block", marginBottom: "6px" }}>
              Profile Image (Upload from system)
            </label>
            <input
              id="instructor-avatar-upload"
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
              onChange={(e) => setFirstName(e.target.value)}
              required
              maxLength={100}
            />
          </div>

          <div>
            <label htmlFor="last_name">Last name</label>
            <input
              id="last_name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              maxLength={100}
            />
          </div>
        </div>

        <label htmlFor="email" style={{ marginTop: "12px" }}>Email address</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "12px" }}>
          <div>
            <label htmlFor="title">Professional title</label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
            />
          </div>

          <div>
            <label htmlFor="phone">Phone Number</label>
            <input
              id="phone"
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
          </div>
        </div>

        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "12px" }}>
          <div>
            <label htmlFor="dob">Date of Birth (DOB)</label>
            <input
              id="dob"
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
            />
          </div>
        </div>

        <label htmlFor="address" style={{ marginTop: "12px" }}>Residential / Office Address</label>
        <input
          id="address"
          type="text"
          placeholder="123 Campus Way, Suite 400"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />

        <label htmlFor="bio">Bio</label>
        <textarea
          id="bio"
          rows={4}
          maxLength={3000}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Teaching experience, credentials, and focus areas"
        />

        {isNew && <p className="hint">A temporary password will be generated for testing. The instructor must change it after login.</p>}
        {error && <p className="error-text">{error}</p>}

        <div className="form-actions" style={{ marginTop: "20px" }}>
          <button type="submit" disabled={saving || uploadingAvatar}>
            {saving ? "Saving..." : isNew ? "Create Instructor" : "Save Changes"}
          </button>
          <button type="button" onClick={() => navigate("/super-admin/instructors")}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
