import { Link } from "react-router-dom";
import { Icon } from "@/components/icons";
import { formatCurrencyAmount } from "@/utils/currency";
import { instituteOnboardingsStrings as strings } from "../InstituteOnboardings.strings";
import type { OnboardingRow } from "../types";

interface OnboardingsTableProps {
  rows: OnboardingRow[];
  onRequestDelete: (row: OnboardingRow) => void;
}

export function OnboardingsTable({ rows, onRequestDelete }: OnboardingsTableProps) {
  const t = strings.table;
  return (
    <div className="table-wrap">
      <table className="data-table sleek-institutes-table">
        <thead>
          <tr>
            <th>{t.institute}</th>
            <th>{t.agreement}</th>
            <th>{t.payment}</th>
            <th>{t.allocation}</th>
            <th>{t.courses}</th>
            <th>{t.status}</th>
            <th className="table-actions-heading" style={{ textAlign: "right", paddingRight: 24 }}>
              {t.actions}
            </th>
          </tr>
        </thead>
        <tbody>
          {!rows.length ? (
            <tr>
              <td colSpan={7} className="empty-cell">
                {t.empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className="table-item-cell">
                    <div className="table-avatar-tile">{row.name.charAt(0).toUpperCase()}</div>
                    <div className="table-item-details">
                      <span className="table-item-title">{row.name}</span>
                      <span className="table-item-subtitle" style={{ fontSize: 11.5, color: "var(--slate-400)" }}>
                        {row.contact_email || t.noContactEmail}
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  <strong style={{ fontSize: 13.5 }}>
                    {formatCurrencyAmount(row.agreed_amount || 0, row.agreement_currency)}
                  </strong>
                </td>
                <td>
                  <div className="table-item-details">
                    <span className="table-item-title" style={{ fontSize: 13, fontWeight: 500 }}>
                      {row.payment ? formatCurrencyAmount(row.payment.amount_paid || 0, row.agreement_currency) : t.notRecorded}
                    </span>
                    <span className="table-item-subtitle" style={{ fontSize: 11.5, color: row.payment?.status === "paid" ? "var(--green-600)" : "var(--slate-400)" }}>
                      {row.payment?.status || t.pending}
                    </span>
                  </div>
                </td>
                <td>
                  <div className="onboarding-allocation-cell">
                    <div className="table-item-details onboarding-allocation-pill">
                      <span className="table-item-title">
                        {t.studentsStaffSuffix(row.student_limit, row.staff_limit)}
                      </span>
                      <span className="table-item-subtitle">
                        {t.accountsIssuedSuffix(row.member_count)}
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="badge badge-gray" style={{ fontWeight: 600 }}>
                    {row.course_count}
                  </span>
                </td>
                <td>
                  <span className={`badge ${row.onboarding_status === "published" ? "badge-green" : "badge-amber"}`}>
                    {row.onboarding_status === "published" ? strings.statusFilter.published : strings.statusFilter.draft}
                  </span>
                </td>
                <td className="table-actions" style={{ paddingRight: 24 }}>
                  <Link
                    className="action-btn-icon action-edit"
                    to={`/super-admin/onboarding/${row.id}`}
                    data-tooltip={row.onboarding_status === "draft" ? t.continueOnboarding : t.viewDetails}
                  >
                    <Icon name={row.onboarding_status === "draft" ? "edit" : "overview"} />
                  </Link>
                  {row.onboarding_status === "draft" && (
                    <button
                      type="button"
                      className="action-btn-icon action-delete"
                      onClick={() => onRequestDelete(row)}
                      data-tooltip={t.deleteDraft}
                    >
                      <Icon name="trash" />
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
