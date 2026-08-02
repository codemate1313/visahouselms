import { Icon } from "@/components/icons";
import { RowActionMenu } from "@/components/RowActionMenu";
import { DataTableCard } from "@/components/ui";
import { paymentMethodsStrings as strings } from "../PaymentMethods.strings";
import type { MethodRow } from "../types";
import { ACTIVATION_STATUS_LABELS } from "@/constants";

interface MethodsTableProps {
  methods: MethodRow[];
  onToggleActive: (method: MethodRow) => void;
  onRequestDelete: (method: MethodRow) => void;
}

export function MethodsTable({ methods, onToggleActive, onRequestDelete }: MethodsTableProps) {
  const t = strings.table;
  return (
    <DataTableCard>
      <table className="data-table sleek-institutes-table">
        <thead>
          <tr>
            <th>{t.methodName}</th>
            <th>{t.status}</th>
            <th className="table-actions-heading" style={{ textAlign: "center", width: 100, minWidth: 100 }}>
              {t.actions}
            </th>
          </tr>
        </thead>
        <tbody>
          {methods.length === 0 && (
            <tr>
              <td colSpan={3} className="empty-cell">
                {t.empty}
              </td>
            </tr>
          )}
          {methods.map((method) => (
            <tr key={method.id}>
              <td>
                <strong style={{ fontSize: 14, color: "var(--text)" }}>{method.name}</strong>
              </td>
              <td>
                <span className={`badge ${method.is_active ? "badge-green" : "badge-inactive"}`}>
                  {method.is_active ? ACTIVATION_STATUS_LABELS.active : ACTIVATION_STATUS_LABELS.inactive}
                </span>
              </td>
              <td className="table-actions institute-row-actions" style={{ justifyContent: "center" }}>
                <RowActionMenu
                  items={[
                    <button key="status" type="button" onClick={() => onToggleActive(method)}>
                      <Icon name={method.is_active ? "toggleOff" : "toggleOn"} />
                      <span>{method.is_active ? t.deactivate : t.reactivate}</span>
                    </button>,
                    <button key="delete" type="button" className="danger" onClick={() => onRequestDelete(method)}>
                      <Icon name="trash" />
                      <span>{t.delete}</span>
                    </button>,
                  ]}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableCard>
  );
}
