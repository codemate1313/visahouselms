import { Fragment } from "react";
import { logsStrings as strings } from "../Logs.strings";
import { COLUMNS, cellValue } from "../helpers";
import type { LogRow, LogType } from "../types";

interface LogsTableProps {
  tab: LogType;
  rows: LogRow[];
  expanded: number | null;
  onToggleExpand: (id: number) => void;
}

export function LogsTable({ tab, rows, expanded, onToggleExpand }: LogsTableProps) {
  const columns = COLUMNS[tab];
  const expandable = tab === "error" || tab === "crash" || tab === "request";

  return (
    <table className="data-table">
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key}>{col.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={columns.length} className="empty-cell">
              {strings.empty}
            </td>
          </tr>
        )}
        {rows.map((row) => (
          <Fragment key={row.id}>
            <tr className={expandable ? "clickable" : ""} onClick={() => expandable && onToggleExpand(row.id)}>
              {columns.map((col) => (
                <td key={col.key}>{cellValue(row, col.key)}</td>
              ))}
            </tr>
            {expanded === row.id && (
              <tr>
                <td colSpan={columns.length}>
                  <pre className="console-output">
                    {tab === "error" && String(row.stack_trace ?? row.message ?? "")}
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
  );
}
