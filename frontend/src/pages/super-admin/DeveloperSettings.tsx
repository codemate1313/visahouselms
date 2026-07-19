import { type FormEvent, useCallback, useEffect, useState } from "react";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";

type Tab = "smtp" | "fcm" | "maintenance" | "backups";

interface BackupRow {
  id: number;
  filename: string;
  size_bytes: number | null;
  kind: string;
  status: string;
  created_at: string;
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function DeveloperSettings() {
  const [tab, setTab] = useState<Tab>("smtp");

  return (
    <div>
      <h1>Developer Settings</h1>
      <div className="tab-bar">
        {(["smtp", "fcm", "maintenance", "backups"] as Tab[]).map((t) => (
          <button
            key={t}
            className={`tab ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
          >
            {{ smtp: "SMTP", fcm: "Firebase FCM", maintenance: "Maintenance", backups: "Backups" }[t]}
          </button>
        ))}
      </div>
      {tab === "smtp" && <SmtpTab />}
      {tab === "fcm" && <FcmTab />}
      {tab === "maintenance" && <MaintenanceTab />}
      {tab === "backups" && <BackupsTab />}
    </div>
  );
}

/* ---------------- SMTP ---------------- */

function SmtpTab() {
  const [form, setForm] = useState({
    host: "", port: "", username: "", password: "", encryption: "tls", from_address: "",
  });
  const [testTo, setTestTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiClient.get("/super-admin/dev-settings/smtp").then(({ data }) => {
      setForm((prev) => ({
        ...prev,
        host: data.host ?? "",
        port: data.port ?? "",
        username: data.username ?? "",
        password: data.password ?? "",
        encryption: data.encryption ?? "tls",
        from_address: data.from_address ?? "",
      }));
    });
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null); setNotice(null); setBusy(true);
    try {
      await apiClient.put("/super-admin/dev-settings/smtp", form);
      setNotice("SMTP settings saved.");
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to save SMTP settings."));
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setError(null); setNotice(null); setBusy(true);
    try {
      await apiClient.post("/super-admin/dev-settings/smtp/test", { to_address: testTo });
      setNotice(`Test email sent to ${testTo}.`);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Test email failed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form-card wide" onSubmit={save}>
      <div className="form-grid">
        <div>
          <label>Host</label>
          <input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder="smtp.example.com" />
        </div>
        <div>
          <label>Port</label>
          <input value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} placeholder="587" />
        </div>
        <div>
          <label>Username</label>
          <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </div>
        <div>
          <label>Password</label>
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="stored encrypted" />
        </div>
        <div>
          <label>Encryption</label>
          <select value={form.encryption} onChange={(e) => setForm({ ...form, encryption: e.target.value })}>
            <option value="tls">TLS (STARTTLS)</option>
            <option value="ssl">SSL</option>
            <option value="none">None</option>
          </select>
        </div>
        <div>
          <label>From address</label>
          <input value={form.from_address} onChange={(e) => setForm({ ...form, from_address: e.target.value })} placeholder="noreply@example.com" />
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {notice && <p className="success-text">{notice}</p>}

      <div className="form-actions">
        <button type="submit" disabled={busy}>Save SMTP Settings</button>
      </div>

      <div className="test-row">
        <input placeholder="you@example.com" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
        <button type="button" disabled={busy || !testTo} onClick={sendTest}>Send test email</button>
      </div>
    </form>
  );
}

/* ---------------- FCM ---------------- */

function FcmTab() {
  const [configured, setConfigured] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [saJson, setSaJson] = useState("");
  const [deviceToken, setDeviceToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiClient.get("/super-admin/dev-settings/fcm").then(({ data }) => {
      setConfigured(data.configured);
      setProjectId(data.project_id ?? "");
    });
  }, []);

  useEffect(load, [load]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null); setNotice(null); setBusy(true);
    try {
      await apiClient.put("/super-admin/dev-settings/fcm", {
        project_id: projectId || null,
        service_account_json: saJson || null,
      });
      setNotice("FCM settings saved.");
      setSaJson("");
      load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to save FCM settings."));
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setError(null); setNotice(null); setBusy(true);
    try {
      const { data } = await apiClient.post("/super-admin/dev-settings/fcm/test", {
        device_token: deviceToken || null,
      });
      setNotice(
        deviceToken
          ? "Test notification sent."
          : `Credentials valid - token obtained for project ${data.project_id}.`,
      );
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "FCM test failed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form-card wide" onSubmit={save}>
      <p className={configured ? "success-text" : "hint"}>
        {configured ? "✓ Service account configured" : "No service account uploaded yet."}
      </p>

      <label>Project ID (optional - detected from JSON if empty)</label>
      <input value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="my-firebase-project" />

      <label>Service account JSON {configured && "(paste to replace)"}</label>
      <textarea
        rows={7}
        value={saJson}
        onChange={(e) => setSaJson(e.target.value)}
        placeholder='{"type": "service_account", "project_id": "...", ...}'
      />

      {error && <p className="error-text">{error}</p>}
      {notice && <p className="success-text">{notice}</p>}

      <div className="form-actions">
        <button type="submit" disabled={busy}>Save FCM Settings</button>
      </div>

      <div className="test-row">
        <input
          placeholder="Device token (optional - validates credentials if empty)"
          value={deviceToken}
          onChange={(e) => setDeviceToken(e.target.value)}
        />
        <button type="button" disabled={busy || !configured} onClick={test}>
          {deviceToken ? "Send test notification" : "Validate credentials"}
        </button>
      </div>
    </form>
  );
}

/* ---------------- Maintenance ---------------- */

function MaintenanceTab() {
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function pollJob(jobId: number): Promise<void> {
    for (let i = 0; i < 60; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const { data } = await apiClient.get(`/super-admin/dev-settings/jobs/${jobId}`);
      if (data.status === "done") {
        setOutput(`Job #${jobId} finished:\n${data.result ?? ""}`);
        return;
      }
      if (data.status === "failed") {
        setError(`Job #${jobId} failed:\n${data.result ?? ""}`);
        return;
      }
      setOutput(`Job #${jobId} is ${data.status}...`);
    }
    setError(`Job #${jobId} did not finish in time - check again later.`);
  }

  async function run(action: string, label: string) {
    setError(null); setOutput(null); setBusy(action);
    try {
      const { data } = await apiClient.post(`/super-admin/dev-settings/${action}`);
      if (data.job_id) {
        setOutput(`${label} enqueued as job #${data.job_id}...`);
        await pollJob(data.job_id);
      } else {
        setOutput(`${label}:\n${JSON.stringify(data, null, 2)}`);
      }
    } catch (err: unknown) {
      setError(extractErrorMessage(err, `${label} failed.`));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="form-card wide">
      <div className="maintenance-actions">
        <button disabled={busy !== null} onClick={() => run("migrate", "Data migration")}>
          {busy === "migrate" ? "Running..." : "Run data migration"}
        </button>
        <button disabled={busy !== null} onClick={() => run("clear-cache", "Clear cache")}>
          {busy === "clear-cache" ? "Clearing..." : "Clear cache"}
        </button>
        <button disabled={busy !== null} onClick={() => run("storage-link", "Storage link")}>
          {busy === "storage-link" ? "Checking..." : "Storage link"}
        </button>
      </div>
      {error && <pre className="console-output error">{error}</pre>}
      {output && <pre className="console-output">{output}</pre>}
    </div>
  );
}

/* ---------------- Backups ---------------- */

function BackupsTab() {
  const [rows, setRows] = useState<BackupRow[]>([]);
  const [schedule, setSchedule] = useState("none");
  const [retention, setRetention] = useState("5");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiClient.get("/super-admin/backups").then(({ data }) => setRows(data));
    apiClient.get("/super-admin/dev-settings/backup").then(({ data }) => {
      if (data.schedule) setSchedule(data.schedule);
      if (data.retention) setRetention(data.retention);
    });
  }, []);

  useEffect(load, [load]);

  async function saveSettings() {
    setError(null); setNotice(null); setBusy(true);
    try {
      await apiClient.put("/super-admin/dev-settings/backup", { schedule, retention });
      setNotice("Backup settings saved.");
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to save backup settings."));
    } finally {
      setBusy(false);
    }
  }

  async function backupNow() {
    setError(null); setNotice(null); setBusy(true);
    try {
      const { data } = await apiClient.post("/super-admin/backups/run");
      setNotice(`Backup job #${data.job_id} started - refresh the list shortly.`);
      setTimeout(load, 8000);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to start backup."));
    } finally {
      setBusy(false);
    }
  }

  async function download(row: BackupRow) {
    try {
      const response = await apiClient.get(`/super-admin/backups/${row.id}/download`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = row.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Download failed.");
    }
  }

  async function restore(row: BackupRow) {
    const typed = window.prompt(
      `This OVERWRITES the current database with ${row.filename}.\nType RESTORE to confirm:`,
    );
    if (typed === null) return;
    setError(null); setNotice(null); setBusy(true);
    try {
      const { data } = await apiClient.post(`/super-admin/backups/${row.id}/restore`, {
        confirmation: typed,
      });
      setNotice(data.message);
      load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Restore failed."));
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: BackupRow) {
    if (!window.confirm(`Delete ${row.filename}?`)) return;
    setError(null); setNotice(null);
    try {
      await apiClient.delete(`/super-admin/backups/${row.id}`);
      load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Delete failed."));
    }
  }

  return (
    <div>
      <div className="form-card wide" style={{ marginBottom: 20 }}>
        <div className="form-grid">
          <div>
            <label>Schedule</label>
            <select value={schedule} onChange={(e) => setSchedule(e.target.value)}>
              <option value="none">Disabled</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          <div>
            <label>Retention (backups kept)</label>
            <input value={retention} onChange={(e) => setRetention(e.target.value)} />
          </div>
        </div>
        {error && <p className="error-text">{error}</p>}
        {notice && <p className="success-text">{notice}</p>}
        <div className="form-actions">
          <button disabled={busy} onClick={saveSettings}>Save settings</button>
          <button disabled={busy} onClick={backupNow}>Backup now</button>
        </div>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>File</th><th>Size</th><th>Kind</th><th>Status</th><th>Created</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={6} className="empty-cell">No backups yet.</td></tr>
          )}
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.filename}</td>
              <td>{formatBytes(row.size_bytes)}</td>
              <td>{row.kind}</td>
              <td>
                <span className={`badge ${row.status === "done" ? "badge-green" : "badge-amber"}`}>
                  {row.status}
                </span>
              </td>
              <td>{new Date(row.created_at).toLocaleString()}</td>
              <td className="table-actions">
                <button onClick={() => download(row)}>Download</button>
                <button onClick={() => restore(row)}>Restore</button>
                <button className="danger" onClick={() => remove(row)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
