import { logsStrings as strings } from "./Logs.strings";
import type { LogRow, LogType } from "./types";

export const TAB_LABELS: Record<LogType, string> = {
  error: strings.tabs.error,
  api: strings.tabs.api,
  crash: strings.tabs.crash,
  request: strings.tabs.request,
};

export const COLUMNS: Record<LogType, { key: string; label: string }[]> = {
  error: [
    { key: "created_at", label: strings.columns.time },
    { key: "level", label: strings.columns.level },
    { key: "message", label: strings.columns.message },
    { key: "path", label: strings.columns.path },
  ],
  api: [
    { key: "created_at", label: strings.columns.time },
    { key: "method", label: strings.columns.method },
    { key: "path", label: strings.columns.path },
    { key: "status_code", label: strings.columns.status },
    { key: "latency_ms", label: strings.columns.latency },
    { key: "ip_address", label: strings.columns.ip },
  ],
  crash: [
    { key: "detected_at", label: strings.columns.detected },
    { key: "kind", label: strings.columns.kind },
    { key: "detail", label: strings.columns.detail },
  ],
  request: [
    { key: "created_at", label: strings.columns.time },
    { key: "method", label: strings.columns.method },
    { key: "path", label: strings.columns.path },
    { key: "status_code", label: strings.columns.status },
    { key: "latency_ms", label: strings.columns.latency },
    { key: "request_bytes", label: strings.columns.reqBytes },
    { key: "response_bytes", label: strings.columns.respBytes },
  ],
};

export const PAGE_SIZE = 25;

export function cellValue(row: LogRow, key: string): string {
  const value = row[key];
  if (value == null) return "—";
  if (key === "created_at" || key === "detected_at") {
    return new Date(String(value)).toLocaleString();
  }
  if (key === "latency_ms") return `${value} ms`;
  const text = String(value);
  return text.length > 90 ? `${text.slice(0, 90)}…` : text;
}
