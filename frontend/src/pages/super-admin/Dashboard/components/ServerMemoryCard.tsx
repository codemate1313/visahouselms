import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Badge, Modal } from "@/components/ui";
import { Icon } from "@/components/icons";
import { IconButton } from "@/components/ui/IconButton/IconButton";
import { formatDateTime } from "@/utils/date";

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
  total_bytes: number | null;
  used_bytes: number | null;
  available_bytes: number | null;
  cached_bytes: number | null;
  used_percent: number | null;
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

function gb(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "-";
  const value = bytes / 1024 ** 3;
  if (value < 1) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${value.toFixed(value < 10 ? 2 : 1)} GB`;
}

function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "-";
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

function toneFor(percent: number | null | undefined): string {
  if (percent === null || percent === undefined) return "is-unknown";
  if (percent >= 90) return "is-critical";
  if (percent >= 75) return "is-warning";
  return "is-ok";
}

function percentLabel(percent: number | null | undefined): string {
  if (percent === null || percent === undefined) return "-";
  return `${Math.round(percent)}%`;
}

function clampPercent(percent: number | null | undefined): number {
  return Math.min(100, Math.max(0, percent ?? 0));
}

function UsageBar({ percent }: { percent: number | null | undefined }) {
  return (
    <div className={`ai-quota-bar ${toneFor(percent)}`}>
      <span style={{ width: `${clampPercent(percent)}%` }} />
    </div>
  );
}

function ResourceRing({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | null | undefined;
  detail: string;
}) {
  return (
    <div className={`server-resource-ring ${toneFor(value)}`}>
      <div
        className="server-resource-ring-visual"
        style={{ "--pct": `${clampPercent(value)}%` } as CSSProperties & Record<"--pct", string>}
      >
        <b>{percentLabel(value)}</b>
      </div>
      <span>{label}</span>
      <small>{detail}</small>
    </div>
  );
}

function DetailRow({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="server-detail-row">
      <span>{label}</span>
      <b>{value}</b>
      {note ? <small>{note}</small> : null}
    </div>
  );
}

export function ServerMemoryCard() {
  const [data, setData] = useState<ServerMemory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(false);

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
  const swapPercent = data.swap?.used_percent ?? null;
  const storageText = data.storage ? formatBytes(data.storage.bytes) : "-";
  const storageCount = data.storage ? `${data.storage.file_count} file${data.storage.file_count === 1 ? "" : "s"}` : "not scanned";
  const appScope = data.app?.scope === "service" ? "systemd service cgroup" : data.app?.scope === "process" ? "current backend process" : "not available";

  return (
    <>
      <div
        className="clickable-chart-card-wrapper"
        onClick={() => setOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        aria-label="Open structured VPS details"
      >
        <section className="chart-card reference-styled-chart server-memory-card">
          <div className="chart-toolbar">
            <div className="chart-title-area">
              <span className="info-icon-badge"><Icon name="analytics" /></span>
              <div>
                <span className="page-eyebrow">Server</span>
                <h3>Memory on {hostLabel}</h3>
              </div>
            </div>

            <div
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
              onClick={(event) => event.stopPropagation()}
            >
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
              <IconButton
                onClick={() => setOpen(true)}
                className="chart-open-detail-btn"
                label="Open full VPS details"
                variant="plain"
                size="sm"
                icon={<Icon name="analytics" />}
              />
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
                  <b>{data.app ? gb(data.app.bytes) : "-"}</b>
                  <span>{appUsageLabel}</span>
                </div>
              </div>

              <div className="server-resource-rings">
                <ResourceRing label="Memory" value={usedPercent} detail={`${gb(data.available_bytes)} free`} />
                <ResourceRing label="CPU" value={cpuPercent} detail={data.load_average ? `${data.load_average.one} load` : "load missing"} />
                <ResourceRing label="Disk" value={diskPercent} detail={data.disk ? `${gb(data.disk.free_bytes)} free` : "not read"} />
                <ResourceRing label="App" value={appPercent} detail={data.app ? gb(data.app.bytes) : "not tracked"} />
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
                      {appPercent !== null ? ` - ${appPercent}% of the server` : ""}
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

              <div className="server-mini-panels">
                <div>
                  <span>Load avg</span>
                  <b>{data.load_average ? `${data.load_average.one} / ${data.load_average.five} / ${data.load_average.fifteen}` : "-"}</b>
                </div>
                <div>
                  <span>Uptime</span>
                  <b>{formatUptime(data.uptime_seconds)}</b>
                </div>
                <div>
                  <span>Storage</span>
                  <b>{storageText}</b>
                </div>
              </div>

              <p className="ai-quota-note">
                Click to view VPS memory, CPU, disk, swap, storage and backend service details.
              </p>
            </>
          )}
        </section>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} size="lg" title={`VPS details - ${hostLabel}`}>
        <div className="server-detail">
          {error && <p className="error-text">{error}</p>}
          {!data.available ? (
            <p className="hint">{data.note ?? "No memory reading is available on this host."}</p>
          ) : (
            <>
              <div className="ai-quota-figures">
                <div>
                  <b>{gb(data.total_bytes)}</b>
                  <span>total memory</span>
                </div>
                <div>
                  <b>{gb(data.used_bytes)}</b>
                  <span>{percentLabel(usedPercent)} used</span>
                </div>
                <div>
                  <b>{gb(data.available_bytes)}</b>
                  <span>available</span>
                </div>
                <div>
                  <b>{gb(data.cached_bytes)}</b>
                  <span>reclaimable cache</span>
                </div>
              </div>

              <div className="server-detail-graph-grid">
                <ResourceRing label="Memory" value={usedPercent} detail={`${gb(data.used_bytes)} of ${gb(data.total_bytes)}`} />
                <ResourceRing label="CPU load" value={cpuPercent} detail={data.load_average ? `${data.load_average.cpu_count} CPU cores` : "not available"} />
                <ResourceRing label="Root disk" value={diskPercent} detail={data.disk ? `${gb(data.disk.used_bytes)} used` : "not available"} />
                <ResourceRing label="Swap" value={swapPercent} detail={data.swap ? `${gb(data.swap.used_bytes)} used` : "not configured"} />
              </div>

              <section className="server-detail-section">
                <header>
                  <h4>Host</h4>
                  <span>{serverLabel}</span>
                </header>
                <DetailRow label="Hostname" value={data.hostname || "-"} />
                <DetailRow label="CPU cores" value={data.cpu_count ? String(data.cpu_count) : "-"} />
                <DetailRow
                  label="Load average"
                  value={data.load_average ? `${data.load_average.one} / ${data.load_average.five} / ${data.load_average.fifteen}` : "-"}
                  note="1 min / 5 min / 15 min"
                />
                <DetailRow label="Uptime" value={formatUptime(data.uptime_seconds)} />
                <DetailRow label="Last refreshed" value={formatDateTime(data.generated_at)} />
              </section>

              <section className="server-detail-section">
                <header>
                  <h4>Memory</h4>
                  <span>{data.approximate ? "approximate reading" : "kernel reading"}</span>
                </header>
                <div className="ai-quota-keys">
                  <div className="ai-quota-key-row">
                    <span className="ai-quota-key-name">Whole server</span>
                    <span className="ai-quota-key-figure">{percentLabel(usedPercent)} used</span>
                    <UsageBar percent={usedPercent} />
                  </div>
                  {data.app && (
                    <div className="ai-quota-key-row">
                      <span className="ai-quota-key-name">{data.app.label}</span>
                      <span className="ai-quota-key-figure">
                        {gb(data.app.bytes)}
                        {appPercent !== null ? ` - ${appPercent}% of the server` : ""}
                      </span>
                      <UsageBar percent={appPercent} />
                    </div>
                  )}
                  {data.swap && (
                    <div className="ai-quota-key-row">
                      <span className="ai-quota-key-name">Swap</span>
                      <span className="ai-quota-key-figure">{gb(data.swap.used_bytes)} of {gb(data.swap.total_bytes)}</span>
                      <UsageBar percent={data.swap.used_percent} />
                    </div>
                  )}
                </div>
                <p className="ai-quota-note">
                  {gb(data.cached_bytes)} is cache the kernel can give back on demand, so the available number is the
                  useful capacity figure.
                </p>
              </section>

              <section className="server-detail-section">
                <header>
                  <h4>Backend scope</h4>
                  <span>{appScope}</span>
                </header>
                <DetailRow label="Application memory" value={data.app ? gb(data.app.bytes) : "-"} note={data.app?.usage_label} />
                <DetailRow label="Measured as" value={appScope} />
                {data.app?.cgroup_path ? <DetailRow label="Cgroup path" value={data.app.cgroup_path} /> : null}
              </section>

              <section className="server-detail-section">
                <header>
                  <h4>Storage</h4>
                  <span>disk and uploaded files</span>
                </header>
                {data.disk ? (
                  <>
                    <DetailRow label="Root path" value={data.disk.path} />
                    <DetailRow label="Root disk used" value={`${gb(data.disk.used_bytes)} of ${gb(data.disk.total_bytes)}`} note={`${percentLabel(diskPercent)} used`} />
                    <UsageBar percent={diskPercent} />
                    <DetailRow label="Root disk free" value={gb(data.disk.free_bytes)} />
                  </>
                ) : (
                  <DetailRow label="Root disk" value="not available" />
                )}
                <DetailRow
                  label="Public storage"
                  value={storageText}
                  note={`${storageCount}${data.storage?.truncated ? " - partial scan" : ""}`}
                />
                {data.storage?.path ? <DetailRow label="Storage path" value={data.storage.path} /> : null}
              </section>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
