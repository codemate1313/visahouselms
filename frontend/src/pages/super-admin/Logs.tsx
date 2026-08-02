import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { SearchInput, SegmentedControl } from "@/components/ui";
import { Icon } from "@/components/icons";
import { usePageTitleStore } from "@/store/pageTitleStore";

type LogType = "api" | "error" | "crash" | "request";

interface LogResponse {
  items: Record<string, unknown>[];
  total: number;
  page: number;
  page_size: number;
}

const LOG_TYPES: LogType[] = ["api", "error", "crash", "request"];

export function Logs() {
  const [type, setType] = useState<LogType>("error");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<LogResponse | null>(null);
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
      return <span className="badge badge-red">{levelStr}</span>;
    }
    if (norm === "WARN" || norm === "WARNING") {
      return <span className="badge badge-amber">{levelStr}</span>;
    }
    if (norm === "INFO") {
      return <span className="badge badge-blue">{levelStr}</span>;
    }
    return <span className="badge badge-gray">{levelStr}</span>;
  }

  function renderCellValue(column: string, rawVal: unknown) {
    const valStr = String(rawVal ?? "");
    const colKey = column.toLowerCase().replaceAll(" ", "_");

    if (colKey === "level") {
      return renderLevelBadge(valStr);
    }

    if (colKey === "method" && valStr) {
      return <span className="badge badge-gray" style={{ fontFamily: "monospace", fontSize: 11 }}>{valStr}</span>;
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
                    const normCol = column.toLowerCase().replaceAll(" ", "_");
                    return (
                      <th key={column} className={`col-${normCol}`}>
                        {column.replaceAll("_", " ")}
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
                <tr key={String(row.id ?? index)}>
                  {columns.map((column) => {
                    const normCol = column.toLowerCase().replaceAll(" ", "_");
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
    </div>
  );
}
