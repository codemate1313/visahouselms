import { Fragment, useCallback, useEffect, useState } from "react";
import { API_BASE_URL, apiClient } from "../../api/client";
import { useAuthStore } from "../../store/authStore";

type LogType = "error" | "api" | "crash" | "request";

interface LogRow {
  id: number;
  [key: string]: unknown;
}

const TAB_LABELS: Record<LogType, string> = {
  error: "Errors",
  api: "API",
  crash: "Crashes",
  request: "Requests",
};

const COLUMNS: Record<LogType, { key: string; label: string }[]> = {
  error: [
    { key: "created_at", label: "Time" },
    { key: "level", label: "Level" },
    { key: "message", label: "Message" },
    { key: "path", label: "Path" },
  ],
  api: [
    { key: "created_at", label: "Time" },
    { key: "method", label: "Method" },
    { key: "path", label: "Path" },
    { key: "status_code", label: "Status" },
    { key: "latency_ms", label: "Latency" },
    { key: "ip_address", label: "IP" },
  ],
  crash: [
    { key: "detected_at", label: "Detected" },
    { key: "kind", label: "Kind" },
    { key: "detail", label: "Detail" },
  ],
  request: [
    { key: "created_at", label: "Time" },
    { key: "method", label: "Method" },
    { key: "path", label: "Path" },
    { key: "status_code", label: "Status" },
    { key: "latency_ms", label: "Latency" },
    { key: "request_bytes", label: "Req B" },
    { key: "response_bytes", label: "Resp B" },
  ],
};

const PAGE_SIZE = 25;

function cellValue(row: LogRow, key: string): string {
  const value = row[key];
  if (value == null) return "—";
  if (key === "created_at" || key === "detected_at") {
    return new Date(String(value)).toLocaleString();
  }
  if (key === "latency_ms") return `${value} ms`;
  const text = String(value);
  return text.length > 90 ? `${text.slice(0, 90)}…` : text;
}

export function Logs() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [tab, setTab] = useState<LogType>("error");
  const [rows, setRows] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (level && tab === "error") params.set("level", level);
    if (dateFrom) params.set("date_from", `${dateFrom}T00:00:00`);
    if (dateTo) params.set("date_to", `${dateTo}T23:59:59`);
    return params;
  }, [search, level, dateFrom, dateTo, tab]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = buildParams();
      params.set("page", String(page));
      params.set("page_size", String(PAGE_SIZE));
      const { data } = await apiClient.get(`/super-admin/logs/${tab}?${params}`);
      setRows(data.items);
      setTotal(data.total);
    } catch {
      setError("Failed to load logs.");
    } finally {
      setLoading(false);
    }
  }, [tab, page, buildParams]);

  useEffect(() => {
    load();
  }, [load]);

  function switchTab(next: LogType) {
    setTab(next);
    setPage(1);
    setExpanded(null);
    setLevel("");
  }

  async function exportCsv() {
    const params = buildParams();
    const response = await fetch(
      `${API_BASE_URL}/super-admin/logs/${tab}/export.csv?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${tab}_logs.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const columns = COLUMNS[tab];
  const expandable = tab === "error" || tab === "crash" || tab === "request";

  return (
    <div>
      <div className="page-header">
        <h1>Logs</h1>
        <button onClick={exportCsv}>Export CSV</button>
      </div>

      <div className="tab-bar">
        {(Object.keys(TAB_LABELS) as LogType[]).map((t) => (
          <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => switchTab(t)}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="filter-bar">
        <input
          placeholder="Search..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        {tab === "error" && (
          <select value={level} onChange={(e) => { setLevel(e.target.value); setPage(1); }}>
            <option value="">All levels</option>
            <option value="ERROR">ERROR</option>
            <option value="WARNING">WARNING</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
        )}
        <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
        <span className="hint">to</span>
        <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
      </div>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((col) => <th key={col.key}>{col.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={columns.length} className="empty-cell">No log entries.</td></tr>
              )}
              {rows.map((row) => (
                <Fragment key={row.id}>
                  <tr
                    className={expandable ? "clickable" : ""}
                    onClick={() => expandable && setExpanded(expanded === row.id ? null : row.id)}
                  >
                    {columns.map((col) => <td key={col.key}>{cellValue(row, col.key)}</td>)}
                  </tr>
                  {expanded === row.id && (
                    <tr>
                      <td colSpan={columns.length}>
                        <pre className="console-output">
                          {tab === "error" && (String(row.stack_trace ?? row.message ?? ""))}
                          {tab === "crash" && String(row.detail ?? "")}
                          {tab === "request" && JSON.stringify(row.headers ?? {}, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>

          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
            <span>Page {page} of {totalPages} ({total} entries)</span>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next →</button>
          </div>
        </>
      )}
    </div>
  );
}
