import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import type { InstructorAccount, InstructorAccountCreated } from "../../api/types";

const SPECIALIZATIONS = ["Listening", "Reading", "Writing", "Speaking", "Test design"];

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
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [created, setCreated] = useState<InstructorAccountCreated | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isNew) return;
    apiClient.get<InstructorAccount>(`/super-admin/instructors/${id}`)
      .then(({ data }) => {
        setEmail(data.email); setFirstName(data.first_name); setLastName(data.last_name);
        setTitle(data.title); setBio(data.bio ?? ""); setSpecializations(data.specializations);
      })
      .catch(() => setError("Failed to load instructor."))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  function toggleSpecialization(value: string) {
    setSpecializations((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(null);
    const payload = { email, first_name: firstName, last_name: lastName, title, bio: bio || null, specializations };
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
    } finally { setSaving(false); }
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
        <div className="form-grid">
          <div><label htmlFor="first_name">First name</label><input id="first_name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required maxLength={100} /></div>
          <div><label htmlFor="last_name">Last name</label><input id="last_name" value={lastName} onChange={(e) => setLastName(e.target.value)} required maxLength={100} /></div>
        </div>
        <label htmlFor="email">Email</label><input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label htmlFor="title">Professional title</label><input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
        <label>Specializations</label>
        <div className="checkbox-grid">
          {SPECIALIZATIONS.map((item) => <label className="check-option" key={item}><input type="checkbox" checked={specializations.includes(item)} onChange={() => toggleSpecialization(item)} /> {item}</label>)}
        </div>
        <label htmlFor="bio">Bio</label><textarea id="bio" rows={5} maxLength={3000} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Teaching experience, credentials, and focus areas" />
        {isNew && <p className="hint">A temporary password will be generated for testing. The instructor must change it after login.</p>}
        {error && <p className="error-text">{error}</p>}
        <div className="form-actions"><button type="submit" disabled={saving}>{saving ? "Saving..." : isNew ? "Create Instructor" : "Save Changes"}</button><button type="button" onClick={() => navigate("/super-admin/instructors")}>Cancel</button></div>
      </form>
    </div>
  );
}
