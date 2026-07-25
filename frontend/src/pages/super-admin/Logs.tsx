import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Button, Card, PageHeader, SearchInput } from "@/components/ui";

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

  async function loadLogs() {
    setLoading(true);
    setError(null);
    try {
      const { data: response } = await apiClient.get<LogResponse>(`/super-admin/logs/${type}`, {
        params: { search: search.trim() || undefined, page_size: 50 },
      });
      setData(response);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to load logs."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLogs();
  }, [type]);

  const columns = data?.items[0] ? Object.keys(data.items[0]).slice(0, 8) : [];

  return (
    <div>
      <PageHeader
        title="System Logs"
        subtitle="Inspect recent API, request, crash, and error records."
        actions={<Button variant="secondary" onClick={() => void loadLogs()}>Refresh</Button>}
      />

      <Card>
        <div className="toolbar-row">
          <div className="tabs">
            {LOG_TYPES.map((item) => (
              <button key={item} type="button" className={type === item ? "active" : ""} onClick={() => setType(item)}>
                {item}
              </button>
            ))}
          </div>
          <SearchInput
            value={search}
            onChange={setSearch}
            onKeyDown={(event) => {
              if (event.key === "Enter") void loadLogs();
            }}
            placeholder="Search logs..."
          />
        </div>

        {error && <p className="error-text">{error}</p>}
        {loading ? (
          <p>Loading logs...</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {columns.length ? columns.map((column) => <th key={column}>{column.replaceAll("_", " ")}</th>) : <th>Log</th>}
                </tr>
              </thead>
              <tbody>
                {!data?.items.length && (
                  <tr><td colSpan={Math.max(columns.length, 1)} className="empty-cell">No logs found.</td></tr>
                )}
                {data?.items.map((row, index) => (
                  <tr key={String(row.id ?? index)}>
                    {columns.map((column) => (
                      <td key={column}>{String(row[column] ?? "")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
