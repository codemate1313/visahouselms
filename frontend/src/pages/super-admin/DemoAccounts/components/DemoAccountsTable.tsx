import { DataTableCard } from "@/components/ui";
import { demoAccountsStrings as strings } from "../DemoAccounts.strings";
import type { DemoRow } from "../types";

const STATE_BADGES: Record<string, string> = {
  active: "badge-green",
  expired: "badge-red",
  converted: "badge-amber",
};

interface DemoAccountsTableProps {
  rows: DemoRow[];
}

export function DemoAccountsTable({ rows }: DemoAccountsTableProps) {
  const t = strings.table;
  return (
    <DataTableCard>
      <table className="data-table sleek-institutes-table">
        <thead>
          <tr>
            <th>{t.institute}</th>
            <th>{t.limits}</th>
            <th>{t.expires}</th>
            <th>{t.daysRemaining}</th>
            <th>{t.state}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="empty-cell">
                {t.empty}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <div className="table-item-cell">
                  <div className="table-avatar-tile">{row.institute_name.charAt(0).toUpperCase()}</div>
                  <span className="table-item-title">{row.institute_name}</span>
                </div>
              </td>
              <td>
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--slate-700)" }}>
                  {t.coursesTestsSuffix(row.course_limit, row.test_limit)}
                </span>
              </td>
              <td>{new Date(row.expires_at).toLocaleDateString("en-GB")}</td>
              <td>
                <strong style={{ fontSize: 13.5, color: (row.days_remaining ?? 0) <= 3 ? "var(--sa-sidebar-red)" : "var(--slate-900)" }}>
                  {row.days_remaining ?? "—"}
                </strong>
              </td>
              <td>
                <span className={`badge ${STATE_BADGES[row.state]}`}>{row.state}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableCard>
  );
}
