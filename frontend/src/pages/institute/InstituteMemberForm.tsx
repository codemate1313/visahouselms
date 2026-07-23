import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import type { InstituteMember, MemberCapacity } from "./InstituteMembers";

const SUPER_ADMIN_CONTACT_EMAIL = "support@ieltslmspro.com";

interface Props {
  role: InstituteMember["role"];
  instituteId?: number;
  returnPath?: string;
}

export function InstituteMemberForm({ role, instituteId, returnPath }: Props) {
  const params = useParams();
  const id = instituteId === undefined ? params.id : params.memberId ?? params.studentId;
  const isNew = id === undefined;
  const isStudent = role === "STUDENT";
  const label = isStudent ? "student" : "instructor";
  const apiBase = instituteId === undefined ? "/institute" : `/super-admin/institutes/${instituteId}`;
  const basePath = returnPath ?? (instituteId === undefined
    ? isStudent ? "/institute-portal/students" : "/institute-portal/staff"
    : `/super-admin/institutes/${instituteId}/accounts`);
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", first_name: "", last_name: "", phone_number: "", address: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capacity, setCapacity] = useState<MemberCapacity | null>(null);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);

  useEffect(() => {
    if (!isNew) return;
    apiClient.get<MemberCapacity>(`${apiBase}/member-capacity`)
      .then(({ data }) => setCapacity(data))
      .catch((err: unknown) => setError(extractErrorMessage(err, "Failed to load institute capacity.")))
      .finally(() => setLoading(false));
  }, [apiBase, isNew]);

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

  if (isNew) {
    const resource: "students" | "staff" = isStudent ? "students" : "staff";
    const canAdd = Boolean(capacity?.can_add[resource]);
    if (!canAdd) {
      const limit = capacity?.limits[resource];
      return (
        <div>
          <h1>Add {label}</h1>
          <section className="feature-lock-stage" aria-labelledby="member-form-lock-title">
            <div className="feature-lock-preview" aria-hidden="true">
              <form className="form-card wide">
                <div className="form-grid">
                  <div><label>First name</label><input disabled /></div>
                  <div><label>Last name</label><input disabled /></div>
                </div>
                <label>Email</label><input disabled />
                <label>Phone number</label><input disabled />
              </form>
            </div>
            <div className="feature-lock-card">
              <span className="feature-lock-icon" aria-hidden="true" />
              <span className="page-eyebrow">Feature locked</span>
              <h2 id="member-form-lock-title">
                {limit === 0 ? "You do not have this feature" : `${isStudent ? "Student" : "Instructor"} capacity reached`}
              </h2>
              <p>
                {limit === 0
                  ? `This institute has 0 ${isStudent ? "student" : "instructor"} slots assigned. Contact the Super Admin to enable this feature.`
                  : `This institute cannot add more ${isStudent ? "students" : "instructors"} right now.`}
              </p>
              {error && <p className="error-text">{error}</p>}
              <div className="feature-lock-actions">
                <a
                  className="button-link"
                  href={`mailto:${SUPER_ADMIN_CONTACT_EMAIL}?subject=Enable%20${isStudent ? "student" : "instructor"}%20feature`}
                >
                  Contact Super Admin
                </a>
                <button type="button" className="secondary-action" onClick={() => navigate(basePath)}>Back</button>
              </div>
              <p className="hint">Email: {SUPER_ADMIN_CONTACT_EMAIL}</p>
            </div>
          </section>
        </div>
      );
    }
  }

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
  return <InstituteMemberForm role="STUDENT" instituteId={Number(id)} returnPath={`/super-admin/institutes/${id}/accounts`} />;
}

export function SuperAdminInstructorForm() {
  const { id } = useParams();
  return <InstituteMemberForm role="INST_INSTRUCTOR" instituteId={Number(id)} returnPath={`/super-admin/institutes/${id}/accounts`} />;
}
