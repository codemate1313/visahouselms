import { type FormEvent, useCallback, useEffect, useState } from "react";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";

interface DemoRow {
  id: number;
  institute_id: number;
  institute_name: string;
  duration_days: number;
  course_limit: number;
  test_limit: number;
  expires_at: string;
  converted_at: string | null;
  state: "active" | "expired" | "converted";
  days_remaining: number | null;
  created_at: string;
}

interface CreatedDemo {
  admin_email: string;
  admin_temp_password: string;
}

const STATE_BADGES: Record<string, string> = {
  active: "badge-green",
  expired: "badge-red",
  converted: "badge-amber",
};

const EMPTY_FORM = {
  name: "",
  admin_email: "",
  admin_first_name: "",
  admin_last_name: "",
  duration_days: "14",
  course_limit: "2",
  test_limit: "5",
};

export function DemoAccounts() {
  const [rows, setRows] = useState<DemoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreatedDemo | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<DemoRow[]>("/super-admin/demo-accounts");
      setRows(data);
    } catch {
      setError("Failed to load demo accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function set(field: keyof typeof EMPTY_FORM) {
    return (event: { target: { value: string } }) =>
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const { data } = await apiClient.post("/super-admin/demo-accounts", {
        name: form.name,
        admin_email: form.admin_email,
        admin_first_name: form.admin_first_name,
        admin_last_name: form.admin_last_name,
        duration_days: Number(form.duration_days),
        course_limit: Number(form.course_limit),
        test_limit: Number(form.test_limit),
      });
      setCreated({ admin_email: data.admin_email, admin_temp_password: data.admin_temp_password });
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to create demo account."));
    } finally {
      setSaving(false);
    }
  }

  async function copyPassword() {
    if (!created) return;
    await navigator.clipboard.writeText(created.admin_temp_password);
    setCopied(true);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Institute Demo Accounts</h1>
        <button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ New Demo"}
        </button>
      </div>

      {created && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h2>Demo account created</h2>
            <p className="hint">
              Share these credentials with the prospect now — the password
              won't be shown again.
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
              <button type="button" onClick={copyPassword}>{copied ? "Copied!" : "Copy password"}</button>
              <button type="button" onClick={() => setCreated(null)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <form className="form-card wide" onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
          <label htmlFor="name">Prospective institute name</label>
          <input id="name" value={form.name} onChange={set("name")} required />

          <p className="section-title" style={{ marginTop: 16 }}>Demo Admin</p>
          <label htmlFor="admin_email">Admin email</label>
          <input id="admin_email" type="email" value={form.admin_email} onChange={set("admin_email")} required />
          <div className="form-grid">
            <div>
              <label htmlFor="admin_first_name">First name</label>
              <input id="admin_first_name" value={form.admin_first_name} onChange={set("admin_first_name")} required />
            </div>
            <div>
              <label htmlFor="admin_last_name">Last name</label>
              <input id="admin_last_name" value={form.admin_last_name} onChange={set("admin_last_name")} required />
            </div>
            <div>
              <label htmlFor="duration_days">Duration (days)</label>
              <input id="duration_days" type="number" min="1" value={form.duration_days} onChange={set("duration_days")} required />
            </div>
            <div>
              <label htmlFor="course_limit">Course limit</label>
              <input id="course_limit" type="number" min="0" value={form.course_limit} onChange={set("course_limit")} required />
            </div>
            <div>
              <label htmlFor="test_limit">Test limit</label>
              <input id="test_limit" type="number" min="0" value={form.test_limit} onChange={set("test_limit")} required />
            </div>
          </div>

          {error && <p className="error-text">{error}</p>}

          <div className="form-actions">
            <button type="submit" disabled={saving}>{saving ? "Creating..." : "Create Demo Account"}</button>
          </div>
        </form>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Institute</th>
              <th>Limits (courses / tests)</th>
              <th>Expires</th>
              <th>Days left</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} className="empty-cell">No demo accounts yet.</td></tr>
            )}
            {rows.map((row) => (
              <tr key={row.id}>
                <td><strong>{row.institute_name}</strong></td>
                <td>{row.course_limit} / {row.test_limit}</td>
                <td>{new Date(row.expires_at).toLocaleDateString()}</td>
                <td>{row.days_remaining ?? "—"}</td>
                <td>
                  <span className={`badge ${STATE_BADGES[row.state]}`}>{row.state}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
