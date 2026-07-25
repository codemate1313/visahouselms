import { subscriptionsStrings as strings } from "../Subscriptions.strings";
import { STATE_BADGES, stateLabel } from "../helpers";
import type { SubscriptionInfo } from "../types";

interface SubscriptionHistoryTableProps {
  history: SubscriptionInfo[];
  onCancel: (subscriptionId: number) => void;
}

export function SubscriptionHistoryTable({ history, onCancel }: SubscriptionHistoryTableProps) {
  const t = strings.history;
  return (
    <div style={{ marginTop: 32 }}>
      <h2 className="section-title" style={{ marginBottom: 16 }}>
        {t.heading}
      </h2>
      <div className="table-wrap">
        <table className="data-table sleek-institutes-table">
          <thead>
            <tr>
              <th>{t.plan}</th>
              <th>{t.starts}</th>
              <th>{t.expires}</th>
              <th>{t.state}</th>
              <th className="table-actions-heading" style={{ textAlign: "center", width: 110, minWidth: 110 }}>
                {t.actions}
              </th>
            </tr>
          </thead>
          <tbody>
            {history.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong style={{ fontSize: 13.5 }}>{row.plan_name ?? t.defaultPlanName}</strong>
                </td>
                <td>{new Date(row.starts_at).toLocaleDateString("en-GB")}</td>
                <td>{new Date(row.expires_at).toLocaleDateString("en-GB")}</td>
                <td>
                  <span className={`badge ${STATE_BADGES[row.state] ?? "badge-gray"}`}>{stateLabel(row.state)}</span>
                </td>
                <td className="table-actions" style={{ justifyContent: "center" }}>
                  {!row.cancelled_at && (row.state === "active" || row.state === "grace") ? (
                    <button
                      type="button"
                      className="danger-cancel-btn"
                      style={{ padding: "5px 12px", fontSize: 12 }}
                      onClick={() => onCancel(row.id)}
                      data-tooltip={strings.cancelTooltip}
                    >
                      {strings.cancel}
                    </button>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--slate-400)" }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
