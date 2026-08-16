import { DashboardButton } from "@/components/ui";
import { dashboardStrings as strings } from "../Dashboard.strings";

/** Public institute applications create nothing until a Super Admin acts, so an
 *  unreviewed queue is silent failure — someone applied and heard nothing. This
 *  is the only place that queue announces itself. */
export function PendingSignupsAlert({ count }: { count: number }) {
  const t = strings.pendingSignups;

  return (
    <div className="dashboard-plan-alert" role="alert">
      <div className="dashboard-plan-alert-content">
        <div className="dashboard-plan-alert-icon-badge">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <div className="dashboard-plan-alert-text">
          <strong>{t.title(count)}</strong>
          <span>{t.body}</span>
        </div>
      </div>
      <DashboardButton to="/super-admin/institute-signups" size="sm">
        {t.cta}
      </DashboardButton>
    </div>
  );
}
