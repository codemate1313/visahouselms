import { Link } from "react-router-dom";
import { dashboardStrings as strings } from "../Dashboard.strings";

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
      <Link className="button-link" to="/super-admin/plans/new">
        {t.cta}
      </Link>
    </div>
  );
}
