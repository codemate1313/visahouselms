import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../api/client";
import { useAuthStore } from "../../store/authStore";

interface MemberSummary {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface DashboardSummary {
  institute: { name: string; contact_email: string | null };
  counts: { students: number; instructors: number; active_members: number };
  subscription: null | {
    state: string;
    usage: { students: number; staff: number; tests: number };
    limits: { students: number; staff: number; tests: number } | null;
    subscription: { plan_name: string; expires_at: string; days_remaining: number | null } | null;
  };
  permissions: Record<string, boolean>;
  recent_members: MemberSummary[];
}

const STATE_CLASS: Record<string, string> = {
  active: "badge-green",
  grace: "badge-amber",
  expired: "badge-red",
  none: "badge-gray",
};

export function InstituteDashboard() {
  const user = useAuthStore((state) => state.user);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get<DashboardSummary>("/institute/dashboard")
      .then(({ data }) => setSummary(data))
      .catch(() => setError("Failed to load the institute dashboard."));
  }, []);

  if (error) return <p className="error-text">{error}</p>;
  if (!summary) return <p>Loading...</p>;

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
  const subscription = subscriptionSummary?.subscription;
  const limits = subscriptionSummary?.limits;

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="page-eyebrow">{summary.institute.name}</span>
          <h1>Welcome, {user?.first_name}</h1>
          <p className="page-subtitle">Your institute workspace and assigned access.</p>
        </div>
      </div>

      <div className="stat-tile-row">
        {canSeeStudents && <div className="stat-tile"><p className="stat-label">Students</p><p className="stat-value">{summary.counts.students}</p></div>}
        {canSeeStaff && <div className="stat-tile"><p className="stat-label">Instructors</p><p className="stat-value">{summary.counts.instructors}</p></div>}
        {(canSeeStudents || canSeeStaff) && <div className="stat-tile"><p className="stat-label">Active members</p><p className="stat-value">{summary.counts.active_members}</p></div>}
        {canSeeBilling && <div className="stat-tile"><p className="stat-label">Subscription</p><p className="stat-value stat-value-text">{subscriptionSummary?.state}</p></div>}
      </div>

      <div className="workspace-grid">
        {canSeeBilling && subscriptionSummary && <section className="workspace-panel">
          <div className="panel-heading">
            <div><h2>Subscription usage</h2><p>{subscription?.plan_name ?? "No active plan"}</p></div>
            <span className={`badge ${STATE_CLASS[subscriptionSummary.state] ?? "badge-gray"}`}>
              {subscriptionSummary.state}
            </span>
          </div>
          {limits ? (
            <div className="usage-list">
              {(["students", "staff", "tests"] as const).map((resource) => {
                const used = subscriptionSummary.usage[resource];
                const limit = limits[resource];
                const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 100;
                return (
                  <div className="usage-row" key={resource}>
                    <div><span>{resource}</span><strong>{used} / {limit}</strong></div>
                    <div className="usage-track"><span style={{ width: `${percent}%` }} /></div>
                  </div>
                );
              })}
              {subscription && <p className="hint">Renews or expires {new Date(subscription.expires_at).toLocaleDateString()}.</p>}
            </div>
          ) : (
            <p className="empty-message">No subscription has been assigned.</p>
          )}
          <Link to="/institute-portal/billing">View subscription</Link>
        </section>}

        {(canSeeStudents || canSeeStaff) && <section className="workspace-panel">
          <div className="panel-heading"><div><h2>Recent members</h2><p>Newest accounts in your institute.</p></div></div>
          {summary.recent_members.length ? (
            <ul className="activity-list">
              {summary.recent_members.map((member) => (
                <li key={member.id}>
                  <span>{member.first_name} {member.last_name}</span>
                  <span>{member.role === "STUDENT" ? "Student" : "Instructor"}</span>
                </li>
              ))}
            </ul>
          ) : <p className="empty-message">No members have been added yet.</p>}
        </section>}

        {!canSeeStudents && !canSeeStaff && !canSeeBilling && (
          <section className="workspace-panel">
            <div className="panel-heading"><div><h2>Access pending</h2></div></div>
            <p className="empty-message">Your Super Admin has not assigned institute management permissions yet.</p>
          </section>
        )}
      </div>
    </div>
  );
}
