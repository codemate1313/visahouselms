import { Link } from "react-router-dom";
import { Icon } from "@/components/icons";
import { RowActionMenu } from "@/components/RowActionMenu";
import { formatCurrencyAmount } from "@/utils/currency";
import { plansStrings as strings } from "../Plans.strings";
import type { PlanRow } from "../types";
import { CATALOGUE_STATUS_LABELS } from "@/constants";

interface PlansTableProps {
  plans: PlanRow[];
  /** Catalogue this table belongs to, so edit links stay inside it. */
  basePath: string;
  emptyMessage: string;
  onToggleActive: (plan: PlanRow) => void;
  onView: (plan: PlanRow) => void;
  onRequestDelete: (plan: PlanRow) => void;
}

export function PlansTable({ plans, basePath, emptyMessage, onToggleActive, onView, onRequestDelete }: PlansTableProps) {
  const t = strings.table;
  return (
    <div className="table-wrap">
      <table className="data-table sleek-plans-table">
        <thead>
          <tr>
            <th style={{ width: "32%" }}>{t.planName}</th>
            <th style={{ width: "22%" }}>{t.priceAndDuration}</th>
            <th style={{ width: "20%" }}>{t.limits}</th>
            <th style={{ width: "12%" }}>{t.status}</th>
            <th className="table-actions-heading" style={{ textAlign: "right", paddingRight: 20 }}>
              {t.actions}
            </th>
          </tr>
        </thead>
        <tbody>
          {plans.length === 0 && (
            <tr>
              <td colSpan={5} className="empty-cell">
                {emptyMessage}
              </td>
            </tr>
          )}
          {plans.map((plan) => (
            <tr key={plan.id}>
              <td>
                <div className="table-item-details">
                  <span className="table-item-title" style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                    {plan.name}
                  </span>
                  <span className="table-item-subtitle" style={{ fontSize: 12, color: "#64748b" }}>
                    {t.target} {plan.audience.replace("_", " ")}
                  </span>
                </div>
              </td>
              <td>
                <div className="table-item-details">
                  <strong style={{ fontSize: 14, color: "#0f172a", whiteSpace: "nowrap" }}>
                    {formatCurrencyAmount(plan.price, plan.currency)}
                  </strong>
                  <span style={{ fontSize: 12, color: "#64748b" }}>
                    {plan.duration_days} {t.daysSuffix}
                  </span>
                </div>
              </td>
              <td>
                <span className="plan-limits-pill" title={`${plan.student_limit} Students / ${plan.staff_limit} Staff / ${plan.test_limit} Tests`}>
                  {plan.student_limit} / {plan.staff_limit} / {plan.test_limit}
                </span>
              </td>
              <td>
                <span className={`badge ${!plan.is_active ? "badge-inactive" : plan.is_published ? "badge-green" : "badge-amber"}`}>
                  {!plan.is_active
                    ? CATALOGUE_STATUS_LABELS.inactive
                    : plan.is_published
                      ? CATALOGUE_STATUS_LABELS.active
                      : CATALOGUE_STATUS_LABELS.draft}
                </span>
              </td>
              <td className="table-actions institute-row-actions">
                <RowActionMenu
                  items={[
                    <button key="status" type="button" onClick={() => onToggleActive(plan)}>
                      <Icon name={plan.is_active ? "toggleOff" : "toggleOn"} />
                      <span>{plan.is_active ? t.deactivate : t.reactivate}</span>
                    </button>,
                    <button key="view" type="button" onClick={() => onView(plan)}>
                      <Icon name="eye" />
                      <span>{t.viewDetails}</span>
                    </button>,
                    <Link key="edit" to={`${basePath}/${plan.id}`}>
                      <Icon name="edit" />
                      <span>{t.edit}</span>
                    </Link>,
                    <button key="delete" type="button" className="danger" onClick={() => onRequestDelete(plan)}>
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
    </div>
  );
}
