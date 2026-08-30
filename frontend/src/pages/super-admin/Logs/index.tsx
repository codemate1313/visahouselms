import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL, apiClient } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { logsStrings as strings } from "./Logs.strings";
import { PAGE_SIZE, TAB_LABELS } from "./helpers";
import type { LogRow, LogType } from "./types";
import { LogsFilterBar } from "./components/LogsFilterBar";
import { LogsTable } from "./components/LogsTable";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";

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
  const loadRequestId = useRef(0);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (level && tab === "error") params.set("level", level);
    if (dateFrom) params.set("date_from", `${dateFrom}T00:00:00`);
    if (dateTo) params.set("date_to", `${dateTo}T23:59:59`);
    return params;
  }, [search, level, dateFrom, dateTo, tab]);

  const load = useCallback(async () => {
    const requestId = ++loadRequestId.current;
    setLoading(true);
    setError(null);
    try {
      const params = buildParams();
      params.set("page", String(page));
      params.set("page_size", String(PAGE_SIZE));
      const { data } = await apiClient.get(`/super-admin/logs/${tab}?${params}`);
      if (requestId !== loadRequestId.current) return;
      setRows(data.items);
      setTotal(data.total);
    } catch {
      if (requestId !== loadRequestId.current) return;
      setError(strings.errors.load);
    } finally {
      if (requestId === loadRequestId.current) setLoading(false);
    }
  }, [tab, page, buildParams]);

  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  function switchTab(next: LogType) {
    setTab(next);
    setPage(1);
    setExpanded(null);
    setLevel("");
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleLevelChange(value: string) {
    setLevel(value);
    setPage(1);
  }

  function handleDateFromChange(value: string) {
    setDateFrom(value);
    setPage(1);
  }

  function handleDateToChange(value: string) {
    setDateTo(value);
    setPage(1);
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

  return (
    <div>
      <div className="page-header">
        <h1>{strings.title}</h1>
        <Button onClick={exportCsv}>{strings.exportCsv}</Button>
      </div>

      <div className="tab-bar">
        {(Object.keys(TAB_LABELS) as LogType[]).map((t) => (
          <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => switchTab(t)}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <LogsFilterBar
        tab={tab}
        search={search}
        onSearchChange={handleSearchChange}
        level={level}
        onLevelChange={handleLevelChange}
        dateFrom={dateFrom}
        onDateFromChange={handleDateFromChange}
        dateTo={dateTo}
        onDateToChange={handleDateToChange}
      />

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p>{strings.loading}</p>
      ) : (
        <>
          <LogsTable tab={tab} rows={rows} expanded={expanded} onToggleExpand={(id) => setExpanded(expanded === id ? null : id)} />

          <div className="pagination">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <Icon name="arrowLeft" /> {strings.pagination.prev}
            </Button>
            <span>{strings.pagination.pageOf(page, totalPages, total)}</span>
            <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              {strings.pagination.next} <Icon name="arrowRight" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
