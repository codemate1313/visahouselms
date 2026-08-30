import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import type { InstructorAccount, InstructorAccountCreated } from "@/api/types";
import { Button, RequiredMark } from "@/components/ui";
import { noChangesMessage } from "@/content/common.strings";
import { useToastStore } from "@/store/toastStore";
import { isEqual } from "@/utils/isEqual";
import { instructorFormStrings as strings } from "./InstructorForm.strings";
import { extractTemporaryPassword } from "./helpers";
import { CreatedInstructorView } from "./components/CreatedInstructorView";
import { AvatarUploadField } from "./components/AvatarUploadField";

export function InstructorForm({ basePath = "/super-admin" }: { basePath?: string }) {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("Language CERT Instructor");
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
  const showInfo = useToastStore((state) => state.showInfo);
  const originalRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (isNew) return;
    apiClient.get<InstructorAccount>(`/super-admin/instructors/${id}`)
      .then(({ data }) => {
        const loadedTitle = data.title ?? "Language CERT Instructor";
        const loadedDob = data.dob ? data.dob.split("T")[0] : "";
        const loadedAvatarPath = data.avatar_path ?? "";
        setEmail(data.email ?? "");
        setFirstName(data.first_name ?? "");
        setLastName(data.last_name ?? "");
        setTitle(loadedTitle);
        setBio(data.bio ?? "");
        setDob(loadedDob);
        setPhoneNumber(data.phone_number ?? "");
        setAddress(data.address ?? "");
        if (data.avatar_path) {
          setAvatarPath(data.avatar_path);
          setAvatarPreview(`/storage/${data.avatar_path}`);
        }
        originalRef.current = {
          email: data.email ?? "",
          first_name: data.first_name ?? "",
          last_name: data.last_name ?? "",
          title: loadedTitle,
          bio: (data.bio ?? "") || null,
          dob: loadedDob ? new Date(loadedDob).toISOString() : null,
          phone_number: (data.phone_number ?? "") || null,
          address: (data.address ?? "") || null,
          avatar_path: loadedAvatarPath || null,
        };
      })
      .catch(() => setError(strings.errors.load))
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
      setError(extractErrorMessage(err, strings.errors.uploadImage));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
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
    if (originalRef.current && isEqual(originalRef.current, payload)) {
      showInfo(noChangesMessage);
      return;
    }
    setSaving(true);
    setError(null);

    try {
      if (isNew) {
        const { data } = await apiClient.post<InstructorAccountCreated>("/super-admin/instructors", payload);
        setCreated(data);
        setCopied(false);
      } else {
        await apiClient.patch(`/super-admin/instructors/${id}`, payload);
        originalRef.current = payload;
        navigate(`${basePath}/instructors`);
      }
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.save));
    } finally {
      setSaving(false);
    }
  }

  async function copyPassword() {
    if (!created) return;
    const temporaryPassword = extractTemporaryPassword(created);
    if (!temporaryPassword) {
      setError(strings.created.missingPasswordError);
      return;
    }
    await navigator.clipboard.writeText(temporaryPassword);
    setCopied(true);
  }

  if (loading) return <p>{strings.loading}</p>;
  if (created) {
    return <CreatedInstructorView created={created} copied={copied} error={error} onCopyPassword={copyPassword} onDone={() => navigate(`${basePath}/instructors`)} />;
  }

  return (
    <div>
      <h1>{isNew ? strings.newTitle : strings.editTitle}</h1>
      <form className="form-card wide" onSubmit={handleSubmit}>
        <AvatarUploadField avatarPreview={avatarPreview} uploadingAvatar={uploadingAvatar} onFileChange={handleFileChange} />

        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <label htmlFor="first_name">{strings.firstName}<RequiredMark /></label>
            <input id="first_name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required maxLength={100} />
          </div>

          <div>
            <label htmlFor="last_name">{strings.lastName}<RequiredMark /></label>
            <input id="last_name" value={lastName} onChange={(e) => setLastName(e.target.value)} required maxLength={100} />
          </div>
        </div>

        <label htmlFor="email" style={{ marginTop: "12px" }}>
          {strings.email}<RequiredMark />
        </label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "12px" }}>
          <div>
            <label htmlFor="title">{strings.title}<RequiredMark /></label>
            <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
          </div>

          <div>
            <label htmlFor="phone">{strings.phone}<RequiredMark /></label>
            <input id="phone" type="tel" placeholder={strings.phonePlaceholder} value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} required />
          </div>
        </div>

        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "12px" }}>
          <div>
            <label htmlFor="dob">{strings.dob}</label>
            <input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </div>
        </div>

        <label htmlFor="address" style={{ marginTop: "12px" }}>
          {strings.address}
        </label>
        <input id="address" type="text" placeholder={strings.addressPlaceholder} value={address} onChange={(e) => setAddress(e.target.value)} />

        <label htmlFor="bio">{strings.bio}</label>
        <textarea id="bio" rows={4} maxLength={3000} value={bio} onChange={(e) => setBio(e.target.value)} placeholder={strings.bioPlaceholder} />

        {isNew && <p className="hint">{strings.passwordHint}</p>}
        {error && <p className="error-text">{error}</p>}

        <div className="form-actions" style={{ marginTop: "20px" }}>
          <Button type="submit" disabled={saving || uploadingAvatar} loading={saving}>
            {saving ? strings.saving : isNew ? strings.createInstructor : strings.saveChanges}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate(`${basePath}/instructors`)}>
            {strings.cancel}
          </Button>
        </div>
      </form>
    </div>
  );
}
