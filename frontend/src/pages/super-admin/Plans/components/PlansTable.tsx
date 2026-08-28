import { Link } from "react-router-dom";
import { Icon } from "@/components/icons";
import { RowActionMenu } from "@/components/RowActionMenu";
import { Badge, DataTableCard } from "@/components/ui";
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
  onTogglePopular: (plan: PlanRow) => void;
  onView: (plan: PlanRow) => void;
  onRequestDelete: (plan: PlanRow) => void;
}

export function PlansTable({ plans, basePath, emptyMessage, onToggleActive, onTogglePopular, onView, onRequestDelete }: PlansTableProps) {
  const t = strings.table;
  return (
    <DataTableCard>
      <table className="data-table sleek-plans-table">
        <thead>
          <tr>
            <th style={{ width: "42%" }}>{t.planName}</th>
            <th style={{ width: "30%" }}>{t.priceAndDuration}</th>
            <th style={{ width: "14%" }}>{t.status}</th>
            <th className="table-actions-heading" style={{ textAlign: "right", paddingRight: 20 }}>
              {t.actions}
            </th>
          </tr>
        </thead>
        <tbody>
          {plans.length === 0 && (
            <tr>
              <td colSpan={4} className="empty-cell">
                {emptyMessage}
              </td>
            </tr>
          )}
          {plans.map((plan) => (
            <tr key={plan.id}>
              <td>
                <div className="table-item-details">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span className="table-item-title" style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                      {plan.name}
                    </span>
                    {plan.is_popular && (
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 800,
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: "linear-gradient(135deg, #a31c28 0%, #dc2626 100%)",
                          color: "#ffffff",
                          letterSpacing: "0.03em",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          boxShadow: "0 2px 6px rgba(163, 28, 40, 0.25)",
                        }}
                      >
                        ★ POPULAR
                      </span>
                    )}
                  </div>
                  <span className="table-item-subtitle" style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {t.target} {plan.audience.replace("_", " ")}
                  </span>
                </div>
              </td>
              <td>
                <div className="table-item-details">
                  <strong style={{ fontSize: 14, color: "var(--text)", whiteSpace: "nowrap" }}>
                    {formatCurrencyAmount(plan.price, plan.currency)}
                  </strong>
                  {plan.is_international_enabled && plan.usd_price && (
                    <span className="ui-chip ui-chip-info" style={{ marginTop: "2px" }}>
                      ${plan.usd_price} USD (Intl)
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {plan.duration_days} {t.daysSuffix}
                  </span>
                </div>
              </td>

              <td>
                <Badge tone={!plan.is_active ? "inactive" : plan.is_published ? "green" : "amber"}>
                  {!plan.is_active
                    ? CATALOGUE_STATUS_LABELS.inactive
                    : plan.is_published
                      ? CATALOGUE_STATUS_LABELS.active
                      : CATALOGUE_STATUS_LABELS.draft}
                </Badge>
              </td>
              <td className="table-actions institute-row-actions">
                <RowActionMenu
                  items={[
                    <button key="popular" type="button" onClick={() => onTogglePopular(plan)}>
                      <Icon name={plan.is_popular ? "starFilled" : "star"} />
                      <span>{plan.is_popular ? t.unmarkPopular : t.markPopular}</span>
                    </button>,
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
    </DataTableCard>
  );
}
