import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Badge, Modal, SearchInput, SegmentedControl } from "@/components/ui";
import { Icon } from "@/components/icons";
import { usePageTitleStore } from "@/store/pageTitleStore";

type LogType = "error" | "crash" | "request";

interface LogResponse {
  items: Record<string, unknown>[];
  total: number;
  page: number;
  page_size: number;
}

const LOG_TYPES: LogType[] = ["request", "error", "crash"];
const DETAIL_PRIORITY = ["id", "level", "message", "stack_trace", "path", "method", "user_id", "ip_address", "created_at", "timestamp"];

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

function getOrderedLogEntries(row: Record<string, unknown>) {
  const keys = Object.keys(row);
  const priorityKeys = DETAIL_PRIORITY.filter((key) => keys.includes(key));
  const rest = keys.filter((key) => !priorityKeys.includes(key)).sort((a, b) => a.localeCompare(b));
  return [...priorityKeys, ...rest].map((key) => [key, row[key]] as const);
}

export function Logs() {
  const [type, setType] = useState<LogType>("error");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<LogResponse | null>(null);
  const [selectedLog, setSelectedLog] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setItemCount = usePageTitleStore((state) => state.setItemCount);
  const searchRef = useRef(search);
  searchRef.current = search;

  const loadLogs = useCallback(async () => {
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

  const columns = data?.items[0] ? Object.keys(data.items[0]).slice(0, 8) : [];

  function renderLevelBadge(levelStr: string) {
    const norm = levelStr.toUpperCase();
    if (norm === "ERROR" || norm === "CRITICAL") {
      return <Badge tone="red">{levelStr}</Badge>;
    }
    if (norm === "WARN" || norm === "WARNING") {
      return <Badge tone="amber">{levelStr}</Badge>;
    }
    if (norm === "INFO") {
      return <Badge tone="blue">{levelStr}</Badge>;
    }
    return <Badge tone="gray">{levelStr}</Badge>;
  }

  function renderCellValue(column: string, rawVal: unknown) {
    const valStr = String(rawVal ?? "");
    const colKey = normalizeKey(column);

    if (colKey === "level") {
      return renderLevelBadge(valStr);
    }

    if (colKey === "method" && valStr) {
      return <Badge tone="gray" style={{ fontFamily: "monospace", fontSize: 11 }}>{valStr}</Badge>;
    }

    if (colKey === "stack_trace") {
      return (
        <span className="log-stack-trace-text" title={valStr} style={{ color: "var(--text-muted)", fontSize: 12 }}>
          {valStr}
        </span>
      );
    }

    return (
      <span title={valStr} style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {valStr}
      </span>
    );
  }

  return (
    <div>
      {/* Top Filter Bar */}
      <div className="logs-filter-toolbar">
        <SegmentedControl
          ariaLabel="Log type"
          onChange={setType}
          options={LOG_TYPES.map((value) => ({ label: value.toUpperCase(), value }))}
          size="sm"
          value={type}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <SearchInput
            value={search}
            onChange={setSearch}
            onKeyDown={(event) => {
              if (event.key === "Enter") void loadLogs();
            }}
            placeholder="Search logs..."
          />
          <button
            type="button"
            className="button secondary"
            onClick={() => void loadLogs()}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px" }}
          >
            <Icon name="terminal" />
            Refresh
          </button>
        </div>
      </div>

      {error && <p className="error-text" style={{ marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <p className="hint">Loading logs...</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table sleek-logs-table">
            <thead>
              <tr>
                {columns.length ? (
                  columns.map((column) => {
                    const normCol = normalizeKey(column);
                    return (
                      <th key={column} className={`col-${normCol}`}>
                        {humanizeKey(column)}
                      </th>
                    );
                  })
                ) : (
                  <th>Log</th>
                )}
              </tr>
            </thead>
            <tbody>
              {!data?.items.length && (
                <tr>
                  <td colSpan={Math.max(columns.length, 1)} className="empty-cell">
                    No logs found.
                  </td>
                </tr>
              )}
              {data?.items.map((row, index) => (
                <tr
                  key={String(row.id ?? index)}
                  className="log-row-clickable"
                  tabIndex={0}
                  role="button"
                  aria-label={`View log ${String(row.id ?? index)} details`}
                  onClick={() => setSelectedLog(row)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedLog(row);
                    }
                  }}
                >
                  {columns.map((column) => {
                    const normCol = normalizeKey(column);
                    return (
                      <td key={column} className={`col-${normCol}`}>
                        {renderCellValue(column, row[column])}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        size="lg"
        className="log-detail-modal"
        title={`Log Details${selectedLog?.id ? ` #${String(selectedLog.id)}` : ""}`}
      >
        {selectedLog && (
          <div className="log-detail-dialog">
            <div className="log-detail-summary">
              {Boolean(selectedLog.level) && (
                <div className="log-detail-summary-item">
                  <span>Level</span>
                  {renderLevelBadge(String(selectedLog.level))}
                </div>
              )}
              {Boolean(selectedLog.method) && (
                <div className="log-detail-summary-item">
                  <span>Method</span>
                  <Badge tone="gray" style={{ fontFamily: "monospace", fontSize: 11 }}>{String(selectedLog.method)}</Badge>
                </div>
              )}
              {(() => {
                const timestampVal = selectedLog.created_at || selectedLog.detected_at || selectedLog.timestamp;
                if (!timestampVal) return null;
                let displayTime = String(timestampVal);
                try {
                  displayTime = new Intl.DateTimeFormat("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "medium",
                  }).format(new Date(String(timestampVal)));
                } catch {
                  // Keep fallback
                }
                return (
                  <div className="log-detail-summary-item">
                    <span>Time</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{displayTime}</span>
                  </div>
                );
              })()}
              {Boolean(selectedLog.path) && (
                <div className="log-detail-summary-item is-wide">
                  <span>Path</span>
                  <code>{String(selectedLog.path)}</code>
                </div>
              )}
            </div>

            {getOrderedLogEntries(selectedLog)
              .filter(([key]) => !["created_at", "detected_at", "timestamp"].includes(normalizeKey(key)))
              .map(([key, value]) => {
              const normKey = normalizeKey(key);
              const isLongText = normKey === "message" || normKey === "stack_trace" || formatDetailValue(value).length > 160;
              return (
                <section key={key} className={`log-detail-section${isLongText ? " is-long" : ""}`}>
                  <h3>{humanizeKey(key)}</h3>
                  {isLongText ? (
                    <pre>{formatDetailValue(value)}</pre>
                  ) : (
                    <p>{formatDetailValue(value)}</p>
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
