import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";

interface CreatedInstitute {
  admin_email: string;
  admin_temp_password: string;
}

export function InstituteForm() {
  const { id } = useParams();
  const isNew = id === "new" || id === undefined;
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");
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
        });
        setCreated({ admin_email: data.admin_email, admin_temp_password: data.admin_temp_password });
      } else {
        await apiClient.patch(`/super-admin/institutes/${id}`, {
          name,
          contact_email: contactEmail || null,
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
      <h1>{isNew ? "New Institute" : "Edit Institute"}</h1>
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

        {error && <p className="error-text">{error}</p>}

        <div className="form-actions">
          <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
          <button type="button" onClick={() => navigate("/super-admin/institutes")}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
