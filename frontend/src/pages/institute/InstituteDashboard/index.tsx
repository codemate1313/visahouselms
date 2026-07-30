import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { instituteDashboardStrings as strings } from "./InstituteDashboard.strings";
import type { DashboardSummary } from "./types";
import { DashboardStats } from "./components/DashboardStats";
import { SubscriptionUsagePanel } from "./components/SubscriptionUsagePanel";
import { RecentMembersPanel } from "./components/RecentMembersPanel";
import { AccessCountdownCard } from "./components/AccessCountdownCard";

export function InstituteDashboard() {
  const user = useAuthStore((state) => state.user);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get<DashboardSummary>("/institute/dashboard")
      .then(({ data }) => setSummary(data))
      .catch(() => setError(strings.errors.load));
  }, []);

  if (error) return <p className="error-text">{error}</p>;
  if (!summary) return <p>{strings.loading}</p>;

  const permissions = summary.permissions;
  const canSeeStudents = Boolean(
    permissions.view_students
      || permissions.manage_students
      || permissions.view_student_activity
      || permissions.manage_student_sessions,
  );
  const canSeeStaff = Boolean(permissions.manage_staff);
  const subscriptionSummary = summary.subscription;
  const canSeeBilling = Boolean(permissions.view_billing && subscriptionSummary);

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="page-eyebrow">{summary.institute.name}</span>
          <h1>{strings.welcome(user?.first_name)}</h1>
          <p className="page-subtitle">{strings.subtitle}</p>
        </div>
      </div>

      {summary.access && <AccessCountdownCard access={summary.access} canSeeBilling={canSeeBilling} />}

      <DashboardStats
        counts={summary.counts}
        subscriptionState={subscriptionSummary?.state}
        canSeeStudents={canSeeStudents}
        canSeeStaff={canSeeStaff}
        canSeeBilling={canSeeBilling}
      />

      <div className="workspace-grid">
        {canSeeBilling && subscriptionSummary && <SubscriptionUsagePanel subscriptionSummary={subscriptionSummary} />}

        {(canSeeStudents || canSeeStaff) && <RecentMembersPanel members={summary.recent_members} />}

        {!canSeeStudents && !canSeeStaff && !canSeeBilling && (
          <section className="workspace-panel">
            <div className="panel-heading"><div><h2>{strings.accessPending.heading}</h2></div></div>
            <p className="empty-message">{strings.accessPending.description}</p>
          </section>
        )}
      </div>
    </div>
  );
}
