import { dashboardStrings as strings } from "../Dashboard.strings";
import { DashboardButton } from "@/components/ui";

/** The public pricing page renders whatever plans are live, so zero live plans
 *  means prospects land on an empty page — surfaced here until it is fixed. */
export function NoLivePlanAlert() {
  const t = strings.noLivePlan;

  return (
    <div className="dashboard-plan-alert" role="alert">
      <div className="dashboard-plan-alert-content">
        <div className="dashboard-plan-alert-icon-badge">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div className="dashboard-plan-alert-text">
          <strong>{t.title}</strong>
          <span>{t.body}</span>
        </div>
      </div>
      <DashboardButton to="/super-admin/plans" size="lg">
        {t.cta}
      </DashboardButton>
    </div>
  );
}
