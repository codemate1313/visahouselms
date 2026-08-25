import { Link } from "react-router-dom";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Icon } from "@/components/icons";
import { InstructorAnalytics } from "./InstructorAnalytics";
import { ProfileReadinessPanel } from "./ProfileReadinessPanel";
import { RecentActivityPanel } from "./RecentActivityPanel";
import type { InstructorDashboardSummary } from "../types";

interface InstituteInstructorDashboardViewProps {
  summary: InstructorDashboardSummary;
  profilePath: string;
}

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
}

export function InstituteInstructorDashboardView({ summary, profilePath }: InstituteInstructorDashboardViewProps) {
  const totalQueue = summary.queue.pending + summary.queue.claimed;
  const claimedShare = percent(summary.queue.claimed, totalQueue);
  const pendingShare = percent(summary.queue.pending, totalQueue);

  return (
    <>
      <div className="metric-grid instructor-stats">
        <MetricCard label="Awaiting grading" value={summary.queue.pending} tone="amber" icon="grading" />
        <MetricCard label="Claimed by you" value={summary.queue.claimed} tone="blue" icon="session" />
        <MetricCard label="Completed this month" value={summary.grading.completed_this_month} tone="purple" icon="check" />
        <MetricCard label="Reevaluations" value={summary.queue.reevaluations} tone="green" icon="restore" />
      </div>

      <div className="institute-instructor-layout">
        <section className="workspace-panel institute-instructor-workload">
          <div className="panel-heading">
            <div>
              <h2>Grading workload</h2>
              <p>Live queue pressure for submissions from your institute students.</p>
            </div>
            <span className="instructor-impact-icon" aria-hidden="true">
              <Icon name="grading" />
            </span>
          </div>

          <div className="institute-instructor-workload-bar" aria-label="Queue split between unclaimed and claimed submissions">
            <span className="is-pending" style={{ width: `${pendingShare}%` }} />
            <span className="is-claimed" style={{ width: `${claimedShare}%` }} />
          </div>

          <div className="institute-instructor-workload-grid">
            <div>
              <span>Unclaimed</span>
              <strong>{summary.queue.pending}</strong>
            </div>
            <div>
              <span>In evaluation</span>
              <strong>{summary.queue.claimed}</strong>
            </div>
            <div>
              <span>Past due</span>
              <strong>{summary.queue.due_soon}</strong>
            </div>
          </div>

          <Link to="/institute-instructor/grading" className="institute-instructor-queue-link">
            Open grading queue <Icon name="arrowRight" />
          </Link>
        </section>

        <InstructorAnalytics courseUsage={[]} gradingTrend={summary.grading_trend} showLearnerUsage={false} />
      </div>

      <div className="workspace-grid institute-instructor-secondary-grid">
        <ProfileReadinessPanel completion={summary.profile_completion} profilePath={profilePath} />
        <RecentActivityPanel activity={summary.recent_activity} />
      </div>
    </>
  );
}
