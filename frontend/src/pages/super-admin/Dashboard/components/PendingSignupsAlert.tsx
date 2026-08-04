import { DashboardButton } from "@/components/ui";
import { dashboardStrings as strings } from "../Dashboard.strings";

/** Public institute applications create nothing until a Super Admin acts, so an
 *  unreviewed queue is silent failure — someone applied and heard nothing. This
 *  is the only place that queue announces itself. */
export function PendingSignupsAlert({ count }: { count: number }) {
  const t = strings.pendingSignups;

  return (
    <div className="dashboard-plan-alert" role="alert">
      <div className="dashboard-plan-alert-text">
        <strong>{t.title(count)}</strong>
        <span>{t.body}</span>
      </div>
      <DashboardButton to="/super-admin/institute-signups" size="lg">
        {t.cta}
      </DashboardButton>
    </div>
  );
}
