import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import type { InstituteMember } from "./InstituteMembers";

interface Props {
  role: InstituteMember["role"];
  instituteId?: number;
}

export function InstituteMemberForm({ role, instituteId }: Props) {
  const params = useParams();
  const id = instituteId === undefined ? params.id : params.studentId;
  const isNew = id === undefined;
  const isStudent = role === "STUDENT";
  const label = isStudent ? "student" : "instructor";
  const apiBase = instituteId === undefined ? "/institute" : `/super-admin/institutes/${instituteId}`;
  const basePath = instituteId === undefined
    ? isStudent ? "/institute-portal/students" : "/institute-portal/staff"
    : `/super-admin/institutes/${instituteId}/students`;
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", first_name: "", last_name: "", phone_number: "", address: "" });
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) return;
    apiClient.get<InstituteMember>(`${apiBase}/members/${id}`)
      .then(({ data }) => {
        if (data.role !== role) {
          navigate(basePath, { replace: true });
          return;
        }
        setForm({
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          phone_number: data.phone_number ?? "",
          address: data.address ?? "",
        });
      })
      .catch((err: unknown) => setError(extractErrorMessage(err, `Failed to load the ${label}.`)))
      .finally(() => setLoading(false));
  }, [apiBase, basePath, id, isNew, label, navigate, role]);

  function set(field: keyof typeof form) {
    return (event: React.ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const payload = { ...form, role, phone_number: form.phone_number || null, address: form.address || null };
    try {
      if (isNew) {
        const { data } = await apiClient.post(`${apiBase}/members`, payload);
        setCreatedPassword(data.temporary_password);
      } else {
        await apiClient.patch(`${apiBase}/members/${id}`, payload);
        navigate(basePath);
      }
    } catch (err: unknown) {
      setError(extractErrorMessage(err, `Failed to save the ${label}.`));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Loading...</p>;

  if (createdPassword) {
    return (
      <div>
        <h1>{isStudent ? "Student" : "Instructor"} created</h1>
        <section className="workspace-panel credential-panel">
          <p>Share this temporary password now. The member must change it after signing in.</p>
          <div className="credential-row"><span>Email</span><code>{form.email}</code></div>
          <div className="credential-row"><span>Password</span><code>{createdPassword}</code></div>
          <div className="form-actions"><button onClick={() => navigator.clipboard.writeText(createdPassword)}>Copy password</button><button type="button" onClick={() => navigate(basePath)}>Done</button></div>
        </section>
      </div>
    );
  }

  return (
    <div>
      <h1>{isNew ? `Add ${label}` : `Edit ${label}`}</h1>
      <form className="form-card wide" onSubmit={submit}>
        <div className="form-grid">
          <div><label htmlFor="first_name">First name</label><input id="first_name" value={form.first_name} onChange={set("first_name")} required /></div>
          <div><label htmlFor="last_name">Last name</label><input id="last_name" value={form.last_name} onChange={set("last_name")} required /></div>
        </div>
        <label htmlFor="email">Email</label><input id="email" type="email" value={form.email} onChange={set("email")} required />
        <label htmlFor="phone_number">Phone number</label><input id="phone_number" value={form.phone_number} onChange={set("phone_number")} />
        <label htmlFor="address">Address</label><input id="address" value={form.address} onChange={set("address")} />
        {error && <p className="error-text">{error}</p>}
        <div className="form-actions"><button type="submit" disabled={saving}>{saving ? "Saving..." : `Save ${label}`}</button><button type="button" onClick={() => navigate(basePath)}>Cancel</button></div>
      </form>
    </div>
  );
}

export function SuperAdminStudentForm() {
  const { id } = useParams();
  return <InstituteMemberForm role="STUDENT" instituteId={Number(id)} />;
}
