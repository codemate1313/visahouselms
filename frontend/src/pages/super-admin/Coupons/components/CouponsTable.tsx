import { Link } from "react-router-dom";
import { Icon } from "@/components/icons";
import { RowActionMenu } from "@/components/RowActionMenu";
import { formatCurrencyAmount } from "@/utils/currency";
import { couponsStrings as strings } from "../Coupons.strings";
import type { CouponRow } from "../types";
import { ACTIVATION_STATUS_LABELS } from "@/constants";

interface CouponsTableProps {
  coupons: CouponRow[];
  onToggleActive: (coupon: CouponRow) => void;
  onRequestDelete: (coupon: CouponRow) => void;
}

export function CouponsTable({ coupons, onToggleActive, onRequestDelete }: CouponsTableProps) {
  const t = strings.table;
  return (
    <div className="table-wrap">
      <table className="data-table sleek-institutes-table">
        <thead>
          <tr>
            <th>{t.code}</th>
            <th>{t.discount}</th>
            <th>{t.scope}</th>
            <th>{t.usage}</th>
            <th>{t.validWindow}</th>
            <th>{t.status}</th>
            <th className="table-actions-heading" style={{ textAlign: "center", width: 140, minWidth: 140 }}>
              {t.actions}
            </th>
          </tr>
        </thead>
        <tbody>
          {coupons.length === 0 && (
            <tr>
              <td colSpan={7} className="empty-cell">
                {t.empty}
              </td>
            </tr>
          )}
          {coupons.map((coupon) => (
            <tr key={coupon.id}>
              <td>
                <strong style={{ fontSize: 14, color: "var(--slate-900)", letterSpacing: "0.02em" }}>{coupon.code}</strong>
              </td>
              <td>
                <strong style={{ fontSize: 13.5, color: "var(--sa-sidebar-red)" }}>
                  {coupon.discount_type === "percent" ? `${coupon.value}%` : formatCurrencyAmount(coupon.value)}
                </strong>
              </td>
              <td>
                <span className="badge badge-gray" style={{ textTransform: "uppercase", fontSize: 11 }}>
                  {coupon.scope}
                </span>
              </td>
              <td>
                <span style={{ fontSize: 13, fontWeight: 500 }}>
                  {coupon.usage_count}
                  {coupon.usage_limit ? ` / ${coupon.usage_limit}` : ""}
                </span>
              </td>
              <td>
                <span className="table-item-subtitle" style={{ fontSize: 12, color: "var(--slate-500)" }}>
                  {coupon.valid_from ? new Date(coupon.valid_from).toLocaleDateString("en-GB") : "—"}
                  {" – "}
                  {coupon.valid_until ? new Date(coupon.valid_until).toLocaleDateString("en-GB") : "—"}
                </span>
              </td>
              <td>
                <span className={`badge ${coupon.is_active ? "badge-green" : "badge-inactive"}`}>
                  {coupon.is_active ? ACTIVATION_STATUS_LABELS.active : ACTIVATION_STATUS_LABELS.inactive}
                </span>
              </td>
              <td className="table-actions institute-row-actions" style={{ justifyContent: "center" }}>
                <RowActionMenu
                  items={[
                    <button key="status" type="button" onClick={() => onToggleActive(coupon)}>
                      <Icon name={coupon.is_active ? "toggleOff" : "toggleOn"} />
                      <span>{coupon.is_active ? t.deactivate : t.reactivate}</span>
                    </button>,
                    <Link key="edit" to={`/super-admin/coupons/${coupon.id}`}>
                      <Icon name="edit" />
                      <span>{t.edit}</span>
                    </Link>,
                    <button key="delete" type="button" className="danger" onClick={() => onRequestDelete(coupon)}>
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
