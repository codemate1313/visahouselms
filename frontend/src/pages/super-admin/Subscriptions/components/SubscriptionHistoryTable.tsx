import { Badge, DataTableCard } from "@/components/ui";
import { Button } from "@/components/ui/Button/Button";
import { subscriptionsStrings as strings } from "../Subscriptions.strings";
import { STATE_BADGES, stateLabel } from "../helpers";
import type { SubscriptionInfo } from "../types";
import { formatDate } from "@/utils/date";

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
      <DataTableCard className="subscription-history-wrap">
        <table className="data-table sleek-institutes-table subscription-history-table">
          <colgroup>
            <col className="col-plan" />
            <col className="col-starts" />
            <col className="col-expires" />
            <col className="col-state" />
            <col className="col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th className="col-plan">{t.plan}</th>
              <th className="col-starts">{t.starts}</th>
              <th className="col-expires">{t.expires}</th>
              <th className="col-state">{t.state}</th>
              <th className="table-actions-heading col-actions">
                {t.actions}
              </th>
            </tr>
          </thead>
          <tbody>
            {history.map((row) => (
              <tr key={row.id}>
                <td className="col-plan">
                  <strong style={{ fontSize: 13.5 }}>{row.plan_name ?? t.defaultPlanName}</strong>
                </td>
                <td className="col-starts">{formatDate(row.starts_at)}</td>
                <td className="col-expires">{formatDate(row.expires_at)}</td>
                <td className="col-state">
                  <Badge tone={STATE_BADGES[row.state] ?? "gray"}>{stateLabel(row.state)}</Badge>
                </td>
                <td className="table-actions col-actions">
                  {/* Anything not yet over can be called off - including a term
                      that has been paid for but has not started. */}
                  {!row.cancelled_at && ["active", "grace", "scheduled"].includes(row.state) ? (
                    <Button
                      type="button"
                      variant="danger"
                      className="danger-cancel-btn table-cancel-btn"
                      onClick={() => onCancel(row.id)}
                      data-tooltip={strings.cancelTooltip}
                    >
                      {strings.cancel}
                    </Button>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableCard>
    </div>
  );
}
