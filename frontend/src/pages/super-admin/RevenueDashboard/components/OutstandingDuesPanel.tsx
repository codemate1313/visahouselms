import { Link } from "react-router-dom";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { Icon } from "@/components/icons";
import { revenueDashboardStrings as strings } from "../RevenueDashboard.strings";
import { formatCurrency } from "../helpers";
import type { DueRow } from "../types";

interface OutstandingDuesPanelProps {
  dues: DueRow[];
}

export function OutstandingDuesPanel({ dues }: OutstandingDuesPanelProps) {
  const t = strings.duesPanel;
  return (
    <CollapsiblePanel className="table-card-block" title={t.title} description={t.description} badge={<span className="count-chip">{dues.length}</span>}>
      <div className="table-wrap">
        <table className="data-table sleek-institutes-table">
          <thead>
            <tr>
              <th>{t.institute}</th>
              <th>{t.invoice}</th>
              <th>{t.total}</th>
              <th>{t.paid}</th>
              <th>{t.dueAmount}</th>
              <th className="table-actions-heading" style={{ textAlign: "center", width: 100, minWidth: 100 }}>
                {t.action}
              </th>
            </tr>
          </thead>
          <tbody>
            {dues.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-cell">
                  {t.empty}
                </td>
              </tr>
            )}
            {dues.map((row) => (
              <tr key={row.id}>
                <td>
                  <span className="table-item-title">{row.institute_name ?? t.directStudent}</span>
                </td>
                <td>
                  <span className="table-item-subtitle" style={{ fontSize: 12.5, color: "var(--slate-500)" }}>
                    {row.invoice_number ?? t.notAvailable}
                  </span>
                </td>
                <td>{formatCurrency(row.final_amount)}</td>
                <td>{formatCurrency(row.amount_paid)}</td>
                <td>
                  <span className="badge badge-red" style={{ fontWeight: 700 }}>
                    {formatCurrency(row.due_amount)}
                  </span>
                </td>
                <td className="table-actions" style={{ justifyContent: "center" }}>
                  <Link className="action-btn-icon action-edit" to={`/super-admin/payments/${row.id}/invoice`} data-tooltip={t.viewInvoice}>
                    <Icon name="billings" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CollapsiblePanel>
  );
}
