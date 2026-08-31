import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Badge } from "@/components/ui";
import { IconButton } from "@/components/ui/IconButton/IconButton";

/**
 * Memory on the VPS, read from the kernel each time the card loads.
 *
 * "Available" is the kernel's own estimate of what a new workload could take
 * without swapping, so the used figure excludes cache the kernel would hand
 * back on demand - that is the number worth watching, not MemFree. The site's
 * own share is the backend service's cgroup where systemd provides one; the
 * rest of the used memory belongs to MySQL, nginx and the OS.
 */

interface ServerMemory {
  available: boolean;
  generated_at: string;
  hostname: string;
  host_label?: string;
  server_label?: string;
  note?: string;
  cpu_count?: number | null;
  load_average?: {
    one: number;
    five: number;
    fifteen: number;
    cpu_count: number;
    one_percent: number;
  } | null;
  uptime_seconds?: number | null;
  disk?: {
    path: string;
    total_bytes: number;
    used_bytes: number;
    free_bytes: number;
    used_percent: number | null;
  } | null;
  storage?: {
    path: string;
    bytes: number;
    file_count: number;
    truncated: boolean;
  } | null;
  approximate?: boolean;
  total_bytes?: number;
  used_bytes?: number;
  available_bytes?: number;
  cached_bytes?: number;
  used_percent?: number;
  swap: { total_bytes: number; used_bytes: number; used_percent: number } | null;
  app: {
    bytes: number;
    scope: string;
    label: string;
    usage_label?: string;
    cgroup_path?: string;
    percent_of_total: number | null;
  } | null;
}

const REFRESH_MS = 30_000;

function gb(bytes: number | undefined): string {
  if (bytes === undefined) return "—";
  const value = bytes / 1024 ** 3;
  if (value < 1) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${value.toFixed(value < 10 ? 2 : 1)} GB`;
}

function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined) return "—";
  if (bytes >= 1024 ** 3) return gb(bytes);
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function formatUptime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function shortTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function toneFor(percent: number | null | undefined): string {
  if (percent === null || percent === undefined) return "is-unknown";
  if (percent >= 90) return "is-critical";
  if (percent >= 75) return "is-warning";
  return "is-ok";
}

function UsageBar({ percent }: { percent: number | null | undefined }) {
  return (
    <div className={`ai-quota-bar ${toneFor(percent)}`}>
      <span style={{ width: `${Math.min(100, percent ?? 0)}%` }} />
    </div>
  );
}

export function ServerMemoryCard() {
  const [data, setData] = useState<ServerMemory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: reading } = await apiClient.get<ServerMemory>("/super-admin/dashboard/server-resources", {
        headers: { "X-Skip-Loader": "1" },
      });
      setData(reading);
      setError(null);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Could not read server memory."));
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  if (!data) return null;

  const usedPercent = data.used_percent ?? null;
  const appPercent = data.app?.percent_of_total ?? null;
  const hostLabel = data.host_label || data.hostname || "current server";
  const serverLabel = data.server_label || hostLabel;
  const appUsageLabel = data.app?.usage_label || (data.app?.scope === "process" ? "held by this worker" : "held by this app");
  const cpuPercent = data.load_average?.one_percent ?? null;
  const diskPercent = data.disk?.used_percent ?? null;

  return (
    <section className="chart-card reference-styled-chart server-memory-card">
      <div className="ai-quota-head">
        <div>
          <span className="page-eyebrow">Server</span>
          <h3>Memory on {hostLabel}</h3>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <IconButton
            onClick={handleRefresh}
            disabled={refreshing}
            className="refresh-btn"
            label="Refresh memory reading"
            icon={
              <svg
                className={refreshing ? "spin" : ""}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ width: "16px", height: "16px" }}
              >
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l.73-.73" />
              </svg>
            }
          />
          <Badge
            tone={
              !data.available
                ? "gray"
                : (usedPercent ?? 0) >= 90
                  ? "red"
                  : (usedPercent ?? 0) >= 75
                    ? "amber"
                    : "green"
            }
          >
            {!data.available
              ? "Unavailable"
              : (usedPercent ?? 0) >= 90
                ? "Under pressure"
                : (usedPercent ?? 0) >= 75
                  ? "Getting full"
                  : "Healthy"}
          </Badge>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {!data.available ? (
        <p className="hint">{data.note ?? "No memory reading is available on this host."}</p>
      ) : (
        <>
          <div className="ai-quota-figures">
            <div>
              <b>{gb(data.available_bytes)}</b>
              <span>free to use</span>
            </div>
            <div>
              <b>{gb(data.used_bytes)}</b>
              <span>in use of {gb(data.total_bytes)}</span>
            </div>
            <div>
              <b>{data.app ? gb(data.app.bytes) : "—"}</b>
              <span>{appUsageLabel}</span>
            </div>
          </div>

          <div className="server-health-strip">
            <div
              className="server-health-ring"
              style={{ "--pct": `${Math.min(100, cpuPercent ?? 0)}%` } as CSSProperties & Record<"--pct", string>}
            >
              <span>CPU</span>
              <b>{cpuPercent !== null ? `${Math.round(cpuPercent)}%` : "—"}</b>
            </div>
            <div className="server-health-metrics">
              <div>
                <span>Load avg</span>
                <b>{data.load_average ? `${data.load_average.one} / ${data.load_average.five} / ${data.load_average.fifteen}` : "—"}</b>
              </div>
              <div>
                <span>Uptime</span>
                <b>{formatUptime(data.uptime_seconds)}</b>
              </div>
              <div>
                <span>Refreshed</span>
                <b>{shortTime(data.generated_at)}</b>
              </div>
            </div>
          </div>

          <div className="ai-quota-keys">
            <div className="ai-quota-key-row">
              <span className="ai-quota-key-name">{serverLabel}</span>
              <span className="ai-quota-key-figure">{usedPercent ?? "?"}% used</span>
              <UsageBar percent={usedPercent} />
            </div>

            {data.app && (
              <div className="ai-quota-key-row">
                <span className="ai-quota-key-name">{data.app.label}</span>
                <span className="ai-quota-key-figure">
                  {gb(data.app.bytes)}
                  {appPercent !== null ? ` · ${appPercent}% of the server` : ""}
                </span>
                <UsageBar percent={appPercent} />
              </div>
            )}

            {data.swap && (
              <div className="ai-quota-key-row">
                <span className="ai-quota-key-name">Swap</span>
                <span className="ai-quota-key-figure">
                  {gb(data.swap.used_bytes)} of {gb(data.swap.total_bytes)}
                </span>
                <UsageBar percent={data.swap.used_percent} />
              </div>
            )}
          </div>

          {data.disk && (
            <div className="server-disk-panel">
              <div className="server-disk-head">
                <span>Root disk</span>
                <b>{diskPercent ?? "?"}% used</b>
              </div>
              <UsageBar percent={diskPercent} />
              <div className="server-disk-foot">
                <span>{gb(data.disk.free_bytes)} free</span>
                <span>{gb(data.disk.used_bytes)} of {gb(data.disk.total_bytes)}</span>
              </div>
            </div>
          )}

          <div className="server-storage-row">
            <span>Public storage</span>
            <b>{data.storage ? formatBytes(data.storage.bytes) : "—"}</b>
            {data.storage?.truncated ? <small>partial scan</small> : <small>{data.storage?.file_count ?? 0} files</small>}
          </div>

          <p className="ai-quota-note">
            {gb(data.cached_bytes)} of the used memory is cache the kernel gives back on demand, so it is counted as
            free above.
            {data.app?.scope === "process"
              ? " The site's own figure covers this worker only - the server runs more than one."
              : ""}
            {data.approximate ? " Figures on this host are approximate." : ""}
          </p>
        </>
      )}
    </section>
  );
}
