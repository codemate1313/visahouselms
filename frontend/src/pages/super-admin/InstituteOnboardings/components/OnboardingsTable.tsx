import { Link } from "react-router-dom";
import { Icon } from "@/components/icons";
import { DataTableCard } from "@/components/ui";
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
    <DataTableCard>
      <table className="data-table sleek-onboardings-table">
        <thead>
          <tr>
            <th className="col-institute">{t.institute}</th>
            <th className="col-agreement">{t.agreement}</th>
            <th className="col-payment">{t.payment}</th>
            <th className="col-allocation">{t.allocation}</th>
            <th className="col-courses">{t.courses}</th>
            <th className="col-status">{t.status}</th>
            <th className="table-actions-heading col-actions" style={{ textAlign: "right", paddingRight: 16 }}>
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
                <td className="col-institute">
                  <div className="table-item-cell">
                    <div className="table-avatar-tile">{row.name.charAt(0).toUpperCase()}</div>
                    <div className="table-item-details">
                      <span className="table-item-title">{row.name}</span>
                      <span className="table-item-subtitle" style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                        {row.contact_email || t.noContactEmail}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="col-agreement">
                  <strong style={{ fontSize: 13.5 }}>
                    {formatCurrencyAmount(row.agreed_amount || 0, row.agreement_currency)}
                  </strong>
                </td>
                <td className="col-payment">
                  <div className="table-item-details">
                    <span className="table-item-title" style={{ fontSize: 13, fontWeight: 500 }}>
                      {row.payment ? formatCurrencyAmount(row.payment.amount_paid || 0, row.agreement_currency) : t.notRecorded}
                    </span>
                    <span className="table-item-subtitle" style={{ fontSize: 11.5, color: row.payment?.status === "paid" ? "var(--green-600)" : "var(--text-muted)" }}>
                      {row.payment?.status || t.pending}
                    </span>
                  </div>
                </td>
                <td className="col-allocation">
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
                <td className="col-courses">
                  <span className="badge badge-gray" style={{ fontWeight: 600 }}>
                    {row.course_count}
                  </span>
                </td>
                <td className="col-status">
                  <span className={`badge ${row.onboarding_status === "published" ? "badge-green" : "badge-amber"}`}>
                    {row.onboarding_status === "published" ? strings.statusFilter.published : strings.statusFilter.draft}
                  </span>
                </td>
                <td className="table-actions col-actions" style={{ paddingRight: 16 }}>
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
    </DataTableCard>
  );
}
