import { dashboardStrings as strings } from "../Dashboard.strings";
import { DashboardButton } from "@/components/ui";

/** The public pricing page renders whatever plans are live, so zero live plans
 *  means prospects land on an empty page — surfaced here until it is fixed. */
export function NoLivePlanAlert() {
  const t = strings.noLivePlan;

  return (
    <div className="dashboard-plan-alert" role="alert">
      <div className="dashboard-plan-alert-text">
        <strong>{t.title}</strong>
        <span>{t.body}</span>
      </div>
      <DashboardButton to="/super-admin/plans" size="lg">
        {t.cta}
      </DashboardButton>
    </div>
  );
}
