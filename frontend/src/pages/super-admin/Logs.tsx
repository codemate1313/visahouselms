import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Button, Modal, SearchInput, SegmentedControl } from "@/components/ui";
import { Icon } from "@/components/icons";
import { usePageTitleStore } from "@/store/pageTitleStore";
import { AiEvaluationLog } from "./AiEvaluationLog";

type LogType = "error" | "crash" | "request" | "ai";

interface LogResponse {
  items: Record<string, unknown>[];
  total: number;
  page: number;
  page_size: number;
}

const LOG_TYPES: LogType[] = ["error", "request", "crash", "ai"];
const DETAIL_PRIORITY = [
  "id",
  "level",
  "message",
  "path",
  "method",
  "status_code",
  "latency_ms",
  "ip_address",
  "user_id",
  "created_at",
  "detected_at",
  "kind",
  "detail",
  "stack_trace",
  "headers",
  "user_agent",
];

function normalizeKey(value: string) {
  return value.toLowerCase().replaceAll(" ", "_");
}

function humanizeKey(value: string) {
  return value.replaceAll("_", " ");
}

function formatDetailValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatLogTimestamp(val: unknown) {
  if (!val) return "—";
  try {
    const d = new Date(String(val));
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return String(val);
  }
}

function getOrderedLogEntries(row: Record<string, unknown>) {
  const keys = Object.keys(row);
  const priorityKeys = DETAIL_PRIORITY.filter((key) => keys.includes(key));
  const rest = keys.filter((key) => !priorityKeys.includes(key)).sort((a, b) => a.localeCompare(b));
  return [...priorityKeys, ...rest].map((key) => [key, row[key]] as const);
}

function HttpMethodChip({ method }: { method?: string }) {
  const m = (method || "GET").toUpperCase();
  return <span className={`log-method-chip method-${m.toLowerCase()}`}>{m}</span>;
}

function LogLevelBadge({ level }: { level?: string }) {
  const norm = (level || "INFO").toUpperCase();
  let cls = "level-info";
  if (norm === "ERROR" || norm === "CRITICAL") cls = "level-error";
  else if (norm === "WARN" || norm === "WARNING") cls = "level-warn";

  return <span className={`log-level-pill ${cls}`}>{norm}</span>;
}

function HttpStatusPill({ code }: { code?: unknown }) {
  if (code == null) return null;
  const n = Number(code);
  let cls = "status-info";
  if (n >= 200 && n < 300) cls = "status-success";
  else if (n >= 300 && n < 400) cls = "status-redirect";
  else if (n >= 400 && n < 500) cls = "status-warning";
  else if (n >= 500) cls = "status-danger";

  return <span className={`log-status-pill ${cls}`}>{n || String(code)}</span>;
}

function renderErrorMessage(rawMessage?: unknown) {
  const msg = String(rawMessage || "—").trim();
  const match = msg.match(/^([A-Za-z0-9_]+Error|[A-Za-z0-9_]+Exception|HTTPException(?:\s+\d+)?)/i);
  let errorType = match ? match[1] : "";
  let errorSummary = "";

  if (errorType) {
    const quoteMatch = msg.match(/"([^"]+)"/);
    if (quoteMatch && quoteMatch[1].length < 90) {
      errorSummary = quoteMatch[1];
    } else {
      const rest = msg.slice(errorType.length).replace(/^:\s*/, "").trim();
      if (rest && !rest.startsWith("(pymysql") && !rest.startsWith("Traceback") && rest.length < 80) {
        errorSummary = rest;
      }
    }
  } else {
    const firstLine = msg.split("\n")[0].trim();
    errorSummary = firstLine.length > 70 ? `${firstLine.slice(0, 70)}…` : firstLine;
  }

  return (
    <div className="log-error-cell" title={msg}>
      {errorType ? <span className="log-error-type-tag">{errorType}</span> : null}
      {errorSummary ? <span className="log-error-summary-text">{errorSummary}</span> : null}
    </div>
  );
}

function renderCrashSummary(detail?: unknown, kind?: unknown) {
  const str = String(detail || "").trim();
  let summary = "";

  if (!str) {
    summary = String(kind || "Unhandled Process Exit");
  } else if (str.startsWith("Previous backend process did not shut down cleanly")) {
    summary = "Previous backend process did not shut down cleanly";
  } else if (str.includes("Traceback")) {
    const lines = str.split("\n").map((l) => l.trim()).filter(Boolean);
    const lastLine = lines[lines.length - 1];
    if (lastLine && !lastLine.startsWith("File ")) {
      summary = lastLine;
    } else {
      summary = "Unhandled Process Exception";
    }
  } else {
    const firstLine = str.split("\n")[0].trim();
    summary = firstLine.length > 80 ? `${firstLine.slice(0, 80)}…` : firstLine;
  }

  return (
    <div className="log-crash-summary-cell" title={str || summary}>
      <span className="log-crash-summary-text">{summary}</span>
    </div>
  );
}

export function Logs() {
  const [type, setType] = useState<LogType>("error");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<LogResponse | null>(null);
  const [selectedLog, setSelectedLog] = useState<Record<string, unknown> | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setItemCount = usePageTitleStore((state) => state.setItemCount);
  const searchRef = useRef(search);
  searchRef.current = search;

  const loadLogs = useCallback(async () => {
    if (type === "ai") return; // the AI log loads itself
    setLoading(true);
    setError(null);
    try {
      const { data: response } = await apiClient.get<LogResponse>(`/super-admin/logs/${type}`, {
        params: { search: searchRef.current.trim() || undefined, page_size: 50 },
      });
      setData(response);
      setItemCount(response.total ?? response.items.length);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to load logs."));
      setItemCount(null);
    } finally {
      setLoading(false);
    }
  }, [setItemCount, type]);

  useEffect(() => {
    void loadLogs();
    return () => setItemCount(null);
  }, [loadLogs, setItemCount]);

  function copyToClipboard(text: string, keyName: string) {
    void navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  const typeTabs = (
    <SegmentedControl
      ariaLabel="Log type"
      onChange={setType}
      options={LOG_TYPES.map((value) => ({
        label:
          value === "error" ? "Errors"
          : value === "request" ? "Requests"
          : value === "crash" ? "Crashes"
          : "AI Marking",
        value,
      }))}
      size="sm"
      value={type}
    />
  );

  if (type === "ai") {
    return (
      <div className="logs-page-container">
        <div className="logs-filter-toolbar logs-type-bar">{typeTabs}</div>
        <AiEvaluationLog onCountChange={setItemCount} />
      </div>
    );
  }

  return (
    <div className="logs-page-container">
      {/* Top Filter Bar */}
      <div className="logs-filter-toolbar">
        {typeTabs}

        <div className="logs-filter-actions">
          <SearchInput
            className="logs-search-input"
            width={320}
            value={search}
            onChange={setSearch}
            onKeyDown={(event) => {
              if (event.key === "Enter") void loadLogs();
            }}
            placeholder="Search message, path, IP, user..."
          />
          <Button
            type="button"
            variant="secondary"
            className="button secondary logs-refresh-btn"
            onClick={() => void loadLogs()}
          >
            <Icon name="terminal" />
            Refresh
          </Button>
        </div>
      </div>

      {error && <p className="error-text" style={{ marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <div className="logs-loading-card">
          <span className="logs-spinner" />
          <p className="hint">Loading logs...</p>
        </div>
      ) : (
        <div className="table-wrap logs-table-card">
          <table className="data-table sleek-logs-table">
            <thead>
              {type === "error" && (
                <tr>
                  <th className="th-id">ID</th>
                  <th className="th-level">Level</th>
                  <th className="th-time">Time</th>
                  <th className="th-endpoint">Method & Path</th>
                  <th className="th-message">Error Message</th>
                  <th className="th-actor">User & IP</th>
                  <th className="th-action">Action</th>
                </tr>
              )}
              {type === "request" && (
                <tr>
                  <th className="th-id">ID</th>
                  <th className="th-status">Status</th>
                  <th className="th-endpoint">Method & Path</th>
                  <th className="th-latency">Latency</th>
                  <th className="th-actor">User & IP</th>
                  <th className="th-time">Time</th>
                  <th className="th-action">Action</th>
                </tr>
              )}
              {type === "crash" && (
                <tr>
                  <th className="th-id">ID</th>
                  <th className="th-kind">Kind</th>
                  <th className="th-time">Detected At</th>
                  <th className="th-message">Crash Summary</th>
                  <th className="th-action">Action</th>
                </tr>
              )}
            </thead>
            <tbody>
              {!data?.items.length && (
                <tr>
                  <td colSpan={7} className="empty-cell">
                    No {type} logs recorded yet.
                  </td>
                </tr>
              )}
              {data?.items.map((row, index) => {
                const rowId = String(row.id ?? index);
                const hasUser = Boolean(row.user_name || row.user_email || row.user_id);
                return (
                  <tr
                    key={rowId}
                    className="log-row-clickable"
                    tabIndex={0}
                    role="button"
                    aria-label={`View log #${rowId} details`}
                    onClick={() => setSelectedLog(row)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedLog(row);
                      }
                    }}
                  >
                    {type === "error" && (
                      <>
                        <td className="col-log-id">
                          <span className="log-id-pill">{row.id ? `#${String(row.id)}` : "—"}</span>
                        </td>
                        <td className="col-log-level">
                          <LogLevelBadge level={String(row.level || "ERROR")} />
                        </td>
                        <td className="col-log-time">
                          {formatLogTimestamp(row.created_at ?? row.timestamp)}
                        </td>
                        <td className="col-log-endpoint">
                          <div className="log-method-path-group">
                            {Boolean(row.method) && <HttpMethodChip method={String(row.method)} />}
                            <span className="log-path-text" title={String(row.path ?? "—")}>
                              {String(row.path ?? "—")}
                            </span>
                          </div>
                        </td>
                        <td className="col-log-message">
                          {renderErrorMessage(row.message)}
                        </td>
                        <td className="col-log-actor">
                          <div className="log-actor-group">
                            {hasUser ? (
                              <>
                                <span className="log-user-name" title={String(row.user_name || `User #${String(row.user_id)}`)}>
                                  {String(row.user_name || `User #${String(row.user_id)}`)}
                                </span>
                                {Boolean(row.user_email) && (
                                  <span className="log-user-email" title={String(row.user_email)}>
                                    {String(row.user_email)}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="log-guest-text">Anonymous</span>
                            )}
                            <span className="log-ip-text">{String(row.ip_address ?? "—")}</span>
                          </div>
                        </td>
                        <td className="col-log-action">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="log-view-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(row);
                            }}
                            title="View log details"
                          >
                            View
                          </Button>
                        </td>
                      </>
                    )}

                    {type === "request" && (
                      <>
                        <td className="col-log-id">
                          <span className="log-id-pill">{row.id ? `#${String(row.id)}` : "—"}</span>
                        </td>
                        <td className="col-log-status">
                          <HttpStatusPill code={row.status_code} />
                        </td>
                        <td className="col-log-endpoint">
                          <div className="log-method-path-group">
                            <HttpMethodChip method={String(row.method || "GET")} />
                            <span className="log-path-text" title={String(row.path ?? "—")}>
                              {String(row.path ?? "—")}
                            </span>
                          </div>
                        </td>
                        <td className="col-log-latency">
                          <span
                            className={`log-latency-tag ${
                              Number(row.latency_ms) > 1000
                                ? "slow"
                                : Number(row.latency_ms) > 300
                                ? "moderate"
                                : "fast"
                            }`}
                          >
                            {row.latency_ms != null ? `${row.latency_ms} ms` : "—"}
                          </span>
                        </td>
                        <td className="col-log-actor">
                          <div className="log-actor-group">
                            {hasUser ? (
                              <>
                                <span className="log-user-name" title={String(row.user_name || `User #${String(row.user_id)}`)}>
                                  {String(row.user_name || `User #${String(row.user_id)}`)}
                                </span>
                                {Boolean(row.user_email) && (
                                  <span className="log-user-email" title={String(row.user_email)}>
                                    {String(row.user_email)}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="log-guest-text">Anonymous</span>
                            )}
                            <span className="log-ip-text">{String(row.ip_address ?? "—")}</span>
                          </div>
                        </td>
                        <td className="col-log-time">
                          {formatLogTimestamp(row.created_at ?? row.timestamp)}
                        </td>
                        <td className="col-log-action">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="log-view-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(row);
                            }}
                            title="View request details"
                          >
                            View
                          </Button>
                        </td>
                      </>
                    )}

                    {type === "crash" && (
                      <>
                        <td className="col-log-id">
                          <span className="log-id-pill">{row.id ? `#${String(row.id)}` : "—"}</span>
                        </td>
                        <td className="col-log-kind">
                          <span className="log-kind-badge">{String(row.kind ?? "Crash")}</span>
                        </td>
                        <td className="col-log-time">
                          {formatLogTimestamp(row.detected_at ?? row.created_at)}
                        </td>
                        <td className="col-log-message">
                          {renderCrashSummary(row.detail, row.kind)}
                        </td>
                        <td className="col-log-action">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="log-view-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(row);
                            }}
                            title="View crash details"
                          >
                            View
                          </Button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Full Log Details Modal */}
      <Modal
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        size="lg"
        className="log-detail-modal"
        title={`Log Details${selectedLog?.id ? ` #${String(selectedLog.id)}` : ""}`}
      >
        {selectedLog && (
          <div className="log-detail-dialog">
            {/* Top Quick Summary Badges */}
            <div className="log-detail-summary-bar">
              {Boolean(selectedLog.level) && (
                <div className="log-detail-summary-pill">
                  <span className="summary-pill-label">Level</span>
                  <LogLevelBadge level={String(selectedLog.level)} />
                </div>
              )}
              {Boolean(selectedLog.status_code) && (
                <div className="log-detail-summary-pill">
                  <span className="summary-pill-label">Status</span>
                  <HttpStatusPill code={selectedLog.status_code} />
                </div>
              )}
              {Boolean(selectedLog.method) && (
                <div className="log-detail-summary-pill">
                  <span className="summary-pill-label">Method</span>
                  <HttpMethodChip method={String(selectedLog.method)} />
                </div>
              )}
              {selectedLog.latency_ms != null && (
                <div className="log-detail-summary-pill">
                  <span className="summary-pill-label">Latency</span>
                  <span className="log-latency-tag">{String(selectedLog.latency_ms)} ms</span>
                </div>
              )}
              {Boolean(selectedLog.ip_address) && (
                <div className="log-detail-summary-pill">
                  <span className="summary-pill-label">IP Address</span>
                  <code>{String(selectedLog.ip_address)}</code>
                </div>
              )}
              {Boolean(selectedLog.created_at ?? selectedLog.detected_at) && (
                <div className="log-detail-summary-pill">
                  <span className="summary-pill-label">Timestamp</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                    {formatLogTimestamp(selectedLog.created_at ?? selectedLog.detected_at)}
                  </span>
                </div>
              )}
            </div>

            {/* User Details Banner (if user present) */}
            {(Boolean(selectedLog.user_name) || Boolean(selectedLog.user_email) || Boolean(selectedLog.user_id)) && (
              <div className="log-detail-user-card">
                <div className="user-card-avatar">
                  {String(selectedLog.user_name || selectedLog.user_email || "U").charAt(0).toUpperCase()}
                </div>
                <div className="user-card-info">
                  <div className="user-card-name">
                    {String(selectedLog.user_name || "Registered User")}
                    {Boolean(selectedLog.user_id) && (
                      <span className="user-card-id">ID: #{String(selectedLog.user_id)}</span>
                    )}
                  </div>
                  {Boolean(selectedLog.user_email) && (
                    <div className="user-card-email">{String(selectedLog.user_email)}</div>
                  )}
                </div>
              </div>
            )}

            {Boolean(selectedLog.path) && (
              <div className="log-detail-path-card">
                <div className="path-card-header">
                  <span className="path-card-label">Requested URL Endpoint</span>
                </div>
                <code className="path-card-code">
                  {selectedLog.method ? `${String(selectedLog.method)} ` : ""}
                  {String(selectedLog.path)}
                </code>
              </div>
            )}

            {/* Structured Key-Value Sections */}
            {getOrderedLogEntries(selectedLog)
              .filter(([key]) => !["id", "method", "path", "status_code", "level", "user_name", "user_email"].includes(key))
              .map(([key, value]) => {
                const normKey = normalizeKey(key);
                const isCodeBlock =
                  normKey === "stack_trace" ||
                  normKey === "headers" ||
                  typeof value === "object" ||
                  formatDetailValue(value).includes("\n") ||
                  formatDetailValue(value).length > 120;

                const formatted = formatDetailValue(value);

                return (
                  <section key={key} className={`log-detail-section ${isCodeBlock ? "is-code" : ""}`}>
                    <div className="log-section-header">
                      <h3>{humanizeKey(key)}</h3>
                      {isCodeBlock && formatted !== "—" && (
                        <Button
                          type="button"
                          variant="text"
                          size="sm"
                          className="log-copy-btn"
                          onClick={() => copyToClipboard(formatted, key)}
                        >
                          {copiedKey === key ? "Copied!" : "Copy"}
                        </Button>
                      )}
                    </div>
                    {isCodeBlock ? (
                      <pre className="log-console-box">{formatted}</pre>
                    ) : (
                      <p className="log-text-box">{formatted}</p>
                    )}
                  </section>
                );
              })}
          </div>
        )}
      </Modal>
    </div>
  );
}
