import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Badge, Button, Input, PageHeader } from "@/components/ui";
import { confirmAction } from "@/components/confirmDialog";
import { useToastStore } from "@/store/toastStore";
import { formatDate } from "@/utils/date";
import { startImpersonation } from "@/utils/impersonate";
import "./DeveloperOps.css";

const slug = import.meta.env.VITE_DEVELOPER_ACCESS_SLUG || "vh-control-9f4c2a";
const base = `/developer/${slug}`;

interface Health {
  database_ok: boolean;
  maintenance: boolean;
  read_only: boolean;
  geoip_available: boolean;
  errors_last_hour: number;
  failed_jobs: number;
  pending_jobs: number;
  last_backup: { filename: string; status: string; created_at: string } | null;
  disk: { used_gb: number; total_gb: number; used_percent: number | null } | null;
}
interface AuditEntry {
  id: number;
  action: string;
  actor_email: string | null;
  entity_type: string;
  created_at: string;
}
interface JobRow {
  id: number;
  type: string;
  status: string;
  created_at: string;
}
interface ConfigEntry {
  id: number;
  change: string;
  actor_email: string | null;
  created_at: string;
}

export function DeveloperOps() {
  const showSuccess = useToastStore((s) => s.showSuccess);
  const showError = useToastStore((s) => s.showError);

  const [health, setHealth] = useState<Health | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [config, setConfig] = useState<ConfigEntry[]>([]);
  const [allowlist, setAllowlist] = useState("");
  const [twoFa, setTwoFa] = useState<boolean | null>(null);
  const [enroll, setEnroll] = useState<{ secret: string; otpauth_url: string } | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [toolUserId, setToolUserId] = useState("");

  const load = useCallback(async () => {
    try {
      const [h, a, j, c, ip, fa] = await Promise.all([
        apiClient.get<Health>(`${base}/ops/health`),
        apiClient.get<{ entries: AuditEntry[] }>(`${base}/ops/audit`, { params: { limit: 40 } }),
        apiClient.get<{ jobs: JobRow[] }>(`${base}/ops/jobs`),
        apiClient.get<{ entries: ConfigEntry[] }>(`${base}/ops/config-history`),
        apiClient.get<{ ips: string[] }>(`${base}/ops/ip-allowlist`),
        apiClient.get<{ enabled: boolean }>(`${base}/2fa/status`),
      ]);
      setHealth(h.data);
      setAudit(a.data.entries);
      setJobs(j.data.jobs);
      setConfig(c.data.entries);
      setAllowlist(ip.data.ips.join(", "));
      setTwoFa(fa.data.enabled);
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Could not load operations data."));
    }
  }, [showError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveAllowlist() {
    try {
      const ips = allowlist.split(",").map((s) => s.trim()).filter(Boolean);
      const { data } = await apiClient.put<{ ips: string[] }>(`${base}/ops/ip-allowlist`, { ips });
      setAllowlist(data.ips.join(", "));
      showSuccess("IP allowlist saved.");
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Could not save the allowlist."));
    }
  }

  async function startEnroll() {
    try {
      const { data } = await apiClient.post<{ secret: string; otpauth_url: string }>(`${base}/2fa/enroll`);
      setEnroll(data);
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Could not start 2FA setup."));
    }
  }

  async function confirmEnroll() {
    try {
      await apiClient.post(`${base}/2fa/confirm`, { code: confirmCode.trim() });
      setEnroll(null);
      setConfirmCode("");
      setTwoFa(true);
      showSuccess("Two-factor authentication enabled.");
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "That code was not accepted."));
    }
  }

  async function exportUser() {
    const id = toolUserId.trim();
    if (!id) return;
    try {
      const { data } = await apiClient.get(`${base}/users/${id}/export`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `user-${id}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
      showSuccess("Export downloaded.");
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Could not export this user."));
    }
  }

  async function eraseUser() {
    const id = toolUserId.trim();
    if (!id) return;
    const ok = await confirmAction(
      `Erase user #${id}? Their personal details are scrubbed and the account retired. This cannot be undone.`,
      { title: "Erase user data", confirmText: "Erase", variant: "danger" },
    );
    if (!ok) return;
    try {
      await apiClient.post(`${base}/users/${id}/erase`);
      showSuccess(`User #${id} erased.`);
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Could not erase this user."));
    }
  }

  async function impersonate() {
    const id = toolUserId.trim();
    if (!id) return;
    const ok = await confirmAction(
      `View the platform as user #${id}? You'll see what they see, read-only, until you exit.`,
      { title: "View as user", confirmText: "View as user", variant: "primary" },
    );
    if (!ok) return;
    try {
      await startImpersonation(id);
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Could not start impersonation."));
    }
  }

  return (
    <div className="developer-ops">
      <PageHeader eyebrow="Platform" title="Operations" subtitle="Health, activity, jobs, config history, access control and 2FA." />

      {health && (
        <section className="ops-health-grid">
          <Stat label="Database" ok={health.database_ok} value={health.database_ok ? "OK" : "Down"} />
          <Stat label="Errors (1h)" ok={health.errors_last_hour === 0} value={String(health.errors_last_hour)} />
          <Stat label="Failed jobs" ok={health.failed_jobs === 0} value={String(health.failed_jobs)} />
          <Stat label="Pending jobs" ok value={String(health.pending_jobs)} />
          <Stat label="GeoIP DB" ok={health.geoip_available} value={health.geoip_available ? "Loaded" : "Missing"} />
          <Stat label="Maintenance" ok={!health.maintenance} value={health.maintenance ? "Closed" : "Open"} />
          <Stat label="Read-only" ok={!health.read_only} value={health.read_only ? "On" : "Off"} />
          <Stat
            label="Disk used"
            ok={(health.disk?.used_percent ?? 0) < 90}
            value={health.disk ? `${health.disk.used_percent ?? "?"}%` : "?"}
          />
          <Stat
            label="Last backup"
            ok={Boolean(health.last_backup)}
            value={health.last_backup ? formatDate(health.last_backup.created_at) : "None"}
          />
        </section>
      )}

      <div className="ops-two-col">
        <section className="form-card wide">
          <h3 className="ops-title">Authenticator 2FA</h3>
          {twoFa === null ? (
            <p className="hint">…</p>
          ) : twoFa ? (
            <p className="hint">Two-factor authentication is <strong>enabled</strong> for your login.</p>
          ) : enroll ? (
            <div className="ops-enroll">
              <p className="hint">Add this key to your authenticator app, then enter the code it shows.</p>
              <code className="ops-secret">{enroll.secret}</code>
              <a className="ops-otpauth" href={enroll.otpauth_url}>Open in authenticator app</a>
              <div className="ops-inline">
                <Input value={confirmCode} onChange={(e) => setConfirmCode(e.target.value)} placeholder="6-digit code" />
                <Button type="button" variant="primary" onClick={confirmEnroll}>Confirm</Button>
              </div>
            </div>
          ) : (
            <>
              <p className="hint">Your login is password-only. Add an authenticator app as a second factor.</p>
              <Button type="button" variant="primary" onClick={startEnroll}>Set up 2FA</Button>
            </>
          )}
        </section>

        <section className="form-card wide">
          <h3 className="ops-title">Developer IP allowlist</h3>
          <p className="hint">Comma-separated IPs. Empty means unrestricted. Loopback is always allowed.</p>
          <Input value={allowlist} onChange={(e) => setAllowlist(e.target.value)} placeholder="e.g. 203.0.113.4, 198.51.100.9" />
          <div className="ops-inline">
            <Button type="button" variant="primary" onClick={saveAllowlist}>Save allowlist</Button>
          </div>
        </section>
      </div>

      <div className="ops-two-col">
        <section className="form-card wide">
          <h3 className="ops-title">Recent activity</h3>
          <ul className="ops-list">
            {audit.map((e) => (
              <li key={e.id}>
                <span className="ops-list-main">{e.action}</span>
                <span className="ops-list-sub">{e.actor_email ?? "—"} · {formatDate(e.created_at)}</span>
              </li>
            ))}
            {audit.length === 0 && <li className="hint">No activity.</li>}
          </ul>
        </section>

        <section className="form-card wide">
          <h3 className="ops-title">Config changes</h3>
          <ul className="ops-list">
            {config.map((e) => (
              <li key={e.id}>
                <span className="ops-list-main">{e.change}</span>
                <span className="ops-list-sub">{e.actor_email ?? "—"} · {formatDate(e.created_at)}</span>
              </li>
            ))}
            {config.length === 0 && <li className="hint">No config changes recorded.</li>}
          </ul>
        </section>
      </div>

      <section className="form-card wide">
        <h3 className="ops-title">User tools</h3>
        <p className="hint">
          Enter a user ID to view as them (read-only), export their data, or erase it (GDPR). Admin accounts cannot be
          impersonated or erased.
        </p>
        <div className="ops-inline">
          <Input value={toolUserId} onChange={(e) => setToolUserId(e.target.value.replace(/\D/g, ""))} placeholder="User ID" />
          <Button type="button" variant="secondary" onClick={impersonate} disabled={!toolUserId}>View as</Button>
          <Button type="button" variant="secondary" onClick={exportUser} disabled={!toolUserId}>Export data</Button>
          <Button type="button" variant="danger" onClick={eraseUser} disabled={!toolUserId}>Erase data</Button>
        </div>
      </section>

      <section className="form-card wide">
        <h3 className="ops-title">Background jobs</h3>
        {jobs.length === 0 ? (
          <p className="hint">No jobs recorded.</p>
        ) : (
          <ul className="ops-list">
            {jobs.map((j) => (
              <li key={j.id}>
                <span className="ops-list-main">
                  {j.type}{" "}
                  <Badge tone={j.status === "failed" ? "red" : j.status === "pending" ? "amber" : "green"}>{j.status}</Badge>
                </span>
                <span className="ops-list-sub">{formatDate(j.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <article className={`ops-stat${ok ? " is-ok" : " is-warn"}`}>
      <span className="ops-stat-label">{label}</span>
      <strong className="ops-stat-value">{value}</strong>
    </article>
  );
}
