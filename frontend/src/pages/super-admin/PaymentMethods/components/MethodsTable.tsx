import { Icon } from "@/components/icons";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { paymentMethodsStrings as strings } from "../PaymentMethods.strings";
import type { MethodRow } from "../types";

interface MethodsTableProps {
  methods: MethodRow[];
  onToggleActive: (method: MethodRow) => void;
  onRequestDelete: (method: MethodRow) => void;
}

export function MethodsTable({ methods, onToggleActive, onRequestDelete }: MethodsTableProps) {
  const t = strings.table;
  return (
    <div className="table-wrap">
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
                <strong style={{ fontSize: 14, color: "var(--slate-900)" }}>{method.name}</strong>
              </td>
              <td>
                <span className={`badge ${method.is_active ? "badge-green" : "badge-inactive"}`}>
                  {method.is_active ? strings.statusFilter.active : strings.statusFilter.inactive}
                </span>
              </td>
              <td className="table-actions institute-row-actions" style={{ justifyContent: "center" }}>
                <ToggleSwitch
                  checked={method.is_active}
                  onChange={() => onToggleActive(method)}
                  tooltip={method.is_active ? t.deactivate : t.reactivate}
                />
                <button className="action-btn-icon danger action-delete" onClick={() => onRequestDelete(method)} data-tooltip={t.delete}>
                  <Icon name="trash" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
