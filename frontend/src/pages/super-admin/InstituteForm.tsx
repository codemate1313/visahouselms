import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";

interface CreatedInstitute {
  id: number;
  admin_email: string;
  admin_temp_password: string;
}

type PermissionKey =
  | "view_students"
  | "manage_students"
  | "view_student_activity"
  | "manage_student_sessions"
  | "manage_staff"
  | "view_billing";

type InstitutePermissions = Record<PermissionKey, boolean>;

const DEFAULT_PERMISSIONS: InstitutePermissions = {
  view_students: false,
  manage_students: false,
  view_student_activity: false,
  manage_student_sessions: false,
  manage_staff: false,
  view_billing: false,
};

const PERMISSION_OPTIONS: Array<{ key: PermissionKey; label: string; description: string }> = [
  { key: "view_students", label: "View students", description: "See the institute student directory." },
  { key: "manage_students", label: "Manage students", description: "Edit, activate, deactivate, and delete student accounts." },
  { key: "view_student_activity", label: "View student activity", description: "Review test attempts, grading history, and known devices." },
  { key: "manage_student_sessions", label: "Manage student sessions", description: "Revoke a student's active login session." },
  { key: "manage_staff", label: "Manage instructors", description: "Create, edit, activate, and deactivate institute instructors." },
  { key: "view_billing", label: "View subscription", description: "See the assigned plan, limits, and offline payment history." },
];

export function InstituteForm() {
  const { id } = useParams();
  const isNew = id === "new" || id === undefined;
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");
  const [sessionDurationHours, setSessionDurationHours] = useState(24);
  const [permissions, setPermissions] = useState<InstitutePermissions>(DEFAULT_PERMISSIONS);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreatedInstitute | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isNew) return;
    apiClient
      .get(`/super-admin/institutes/${id}`)
      .then(({ data }) => {
        setName(data.name);
        setContactEmail(data.contact_email ?? "");
        setSessionDurationHours(data.session_duration_hours ?? 24);
        setPermissions({ ...DEFAULT_PERMISSIONS, ...data.admin_permissions });
      })
      .catch(() => setError("Failed to load institute."))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (isNew) {
        const { data } = await apiClient.post("/super-admin/institutes", {
          name,
          contact_email: contactEmail || null,
          admin_email: adminEmail,
          admin_first_name: adminFirstName,
          admin_last_name: adminLastName,
          admin_permissions: permissions,
          session_duration_hours: sessionDurationHours,
        });
        setCreated({ id: data.id, admin_email: data.admin_email, admin_temp_password: data.admin_temp_password });
      } else {
        await apiClient.patch(`/super-admin/institutes/${id}`, {
          name,
          contact_email: contactEmail || null,
          admin_permissions: permissions,
          session_duration_hours: sessionDurationHours,
        });
        navigate("/super-admin/institutes");
      }
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to save institute."));
    } finally {
      setSaving(false);
    }
  }

  async function copyPassword() {
    if (!created) return;
    await navigator.clipboard.writeText(created.admin_temp_password);
    setCopied(true);
  }

  if (loading) return <p>Loading...</p>;

  if (created) {
    return (
      <div className="modal-backdrop">
        <div className="modal-card">
          <h2>Institute created</h2>
          <p className="hint">
            Share these credentials with the institute admin now — the password
            won't be shown again. They'll be required to change it on first login.
          </p>
          <div className="credential-row">
            <span>Email</span>
            <code>{created.admin_email}</code>
          </div>
          <div className="credential-row">
            <span>Temporary password</span>
            <code>{created.admin_temp_password}</code>
          </div>
          <div className="form-actions">
            <button type="button" onClick={copyPassword}>
              {copied ? "Copied!" : "Copy password"}
            </button>
            <button type="button" onClick={() => navigate(`/super-admin/institutes/${created.id}/students`)}>
              Add students
            </button>
            <button type="button" onClick={() => navigate("/super-admin/institutes")}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>{isNew ? "New Institute" : "Edit Institute"}</h1>
        {!isNew && (
          <div className="form-actions">
            <Link className="button-link" to={`/super-admin/institutes/${id}/accounts`}>Accounts</Link>
            <Link className="button-link secondary-button" to={`/super-admin/institutes/${id}/branding`}>Branding</Link>
          </div>
        )}
      </div>
      <form className="form-card wide" onSubmit={handleSubmit}>
        <label htmlFor="name">Institute name</label>
        <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />

        <label htmlFor="contact_email">Contact email</label>
        <input
          id="contact_email"
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="Optional"
        />

        {isNew && (
          <>
            <p className="section-title" style={{ marginTop: 20 }}>First Institute Admin</p>
            <label htmlFor="admin_email">Admin email</label>
            <input
              id="admin_email"
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              required
            />
            <div className="form-grid">
              <div>
                <label htmlFor="admin_first_name">First name</label>
                <input id="admin_first_name" value={adminFirstName} onChange={(e) => setAdminFirstName(e.target.value)} required />
              </div>
              <div>
                <label htmlFor="admin_last_name">Last name</label>
                <input id="admin_last_name" value={adminLastName} onChange={(e) => setAdminLastName(e.target.value)} required />
              </div>
            </div>
            <p className="hint">
              A temporary password is generated automatically and shown once after creation.
            </p>
          </>
        )}

        <fieldset className="permission-fieldset">
          <legend>Session policy</legend>
          <p className="hint">Controls how long institute account sessions remain valid after login. Refreshing the page does not extend this limit.</p>
          <label htmlFor="session-duration-hours">Session lifetime (hours)</label>
          <input
            id="session-duration-hours"
            type="number"
            min="1"
            max="720"
            value={sessionDurationHours}
            onChange={(event) => setSessionDurationHours(Number(event.target.value))}
            required
          />
        </fieldset>

        <fieldset className="permission-fieldset">
          <legend>Institute Admin permissions</legend>
          <p className="hint">Student account creation remains exclusive to the Super Admin.</p>
          <div className="permission-grid">
            {PERMISSION_OPTIONS.map((option) => (
              <label className="permission-option" key={option.key}>
                <input
                  type="checkbox"
                  checked={permissions[option.key]}
                  onChange={(event) => setPermissions((current) => ({
                    ...current,
                    [option.key]: event.target.checked,
                  }))}
                />
                <span><strong>{option.label}</strong><small>{option.description}</small></span>
              </label>
            ))}
          </div>
        </fieldset>

        {error && <p className="error-text">{error}</p>}

        <div className="form-actions">
          <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
          <button type="button" onClick={() => navigate("/super-admin/institutes")}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
