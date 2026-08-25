import type { DashboardSummary } from "../types";

interface InstituteDashboardVisualsProps {
  summary: DashboardSummary;
  canSeeStudents: boolean;
  canSeeStaff: boolean;
  canSeeBilling: boolean;
}

interface QuotaRow {
  label: string;
  used: number;
  limit: number | null;
  accent: "teal" | "indigo" | "amber";
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function buildSparklinePath(points: number[], width: number, height: number) {
  const max = Math.max(...points, 1);
  const step = width / Math.max(points.length - 1, 1);
  return points
    .map((point, index) => {
      const x = index * step;
      const y = height - (point / max) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function getCourseMix(courses: DashboardSummary["assigned_courses"]) {
  const totals = courses.reduce<Record<string, number>>((acc, course) => {
    const key = course.level.replace("_", " ").toLowerCase();
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(totals)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function getRecentMemberTrend(members: DashboardSummary["recent_members"]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const buckets = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return { date, value: 0 };
  });

  members.forEach((member) => {
    const created = new Date(member.created_at);
    if (Number.isNaN(created.getTime())) return;
    created.setHours(0, 0, 0, 0);
    const diffDays = Math.round((created.getTime() - buckets[0].date.getTime()) / 86_400_000);
    if (diffDays >= 0 && diffDays < buckets.length) {
      buckets[diffDays].value += 1;
    }
  });

  return buckets.map((bucket) => bucket.value);
}

export function InstituteDashboardVisuals({
  summary,
  canSeeStudents,
  canSeeStaff,
  canSeeBilling,
}: InstituteDashboardVisualsProps) {
  const subscription = summary.subscription;
  const quotaRows: QuotaRow[] = [];

  if (canSeeStudents && subscription?.limits) {
    quotaRows.push({
      label: "Student seats",
      used: subscription.usage.students,
      limit: subscription.limits.students,
      accent: "teal",
    });
  }

  if (canSeeStaff && subscription?.limits) {
    quotaRows.push({
      label: "Staff seats",
      used: subscription.usage.staff,
      limit: subscription.limits.staff,
      accent: "indigo",
    });
  }

  if (canSeeBilling && subscription?.limits) {
    quotaRows.push({
      label: "Test quota",
      used: subscription.usage.tests,
      limit: subscription.limits.tests,
      accent: "amber",
    });
  }

  const totalMembers = Math.max(summary.counts.students + summary.counts.instructors, 1);
  const studentShare = clampPercent((summary.counts.students / totalMembers) * 100);
  const instructorShare = clampPercent((summary.counts.instructors / totalMembers) * 100);
  const activeShare = totalMembers > 0 ? clampPercent((summary.counts.active_members / totalMembers) * 100) : 0;
  const courseMix = getCourseMix(summary.assigned_courses ?? []);
  const memberTrend = getRecentMemberTrend(summary.recent_members);
  const recentAdds = memberTrend.reduce((sum, value) => sum + value, 0);
  const sparkline = buildSparklinePath(memberTrend, 260, 86);
  const sparklineArea = `${sparkline} L 260 96 L 0 96 Z`;

  return (
    <section className="workspace-panel institute-visuals-panel">
      <div className="panel-heading institute-visuals-heading">
        <div>
          <h2>Institute Snapshot</h2>
          <p>Capacity, activity and course coverage at a glance.</p>
        </div>
        <span className="institute-visuals-pill">{summary.assigned_courses.length} licensed courses</span>
      </div>

      <div className="institute-visuals-grid">
        <article className="institute-chart-card institute-chart-card-wide">
          <div className="institute-chart-card-heading">
            <span>New members this week</span>
            <strong>{recentAdds}</strong>
          </div>
          <svg className="institute-sparkline" viewBox="0 0 260 104" role="img" aria-label="Recent member additions trend">
            <defs>
              <linearGradient id="instituteSparklineFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={sparklineArea} fill="url(#instituteSparklineFill)" />
            <path d={sparkline} fill="none" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            {memberTrend.map((point, index) => {
              const max = Math.max(...memberTrend, 1);
              const x = (260 / Math.max(memberTrend.length - 1, 1)) * index;
              const y = 86 - (point / max) * 86;
              return <circle key={index} cx={x} cy={y} r={index === memberTrend.length - 1 ? 5 : 3} />;
            })}
          </svg>
        </article>

        <article className="institute-chart-card">
          <div className="institute-chart-card-heading">
            <span>Member mix</span>
            <strong>{Math.round(activeShare)}%</strong>
          </div>
          <div className="institute-stacked-bar" aria-label="Student and instructor composition">
            <span className="is-students" style={{ width: `${studentShare}%` }} />
            <span className="is-instructors" style={{ width: `${instructorShare}%` }} />
          </div>
          <div className="institute-mix-legend">
            {canSeeStudents && <span><i className="is-students" /> Students {summary.counts.students}</span>}
            {canSeeStaff && <span><i className="is-instructors" /> Instructors {summary.counts.instructors}</span>}
          </div>
        </article>

        <article className="institute-chart-card">
          <div className="institute-chart-card-heading">
            <span>Course mix</span>
            <strong>{courseMix.length || 0}</strong>
          </div>
          {courseMix.length ? (
            <div className="institute-course-bars">
              {courseMix.slice(0, 4).map((item) => {
                const percent = clampPercent((item.value / summary.assigned_courses.length) * 100);
                return (
                  <div className="institute-course-bar-row" key={item.label}>
                    <span>{item.label}</span>
                    <div><i style={{ width: `${percent}%` }} /></div>
                    <strong>{item.value}</strong>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="empty-message">No course data yet.</p>
          )}
        </article>
      </div>

      {quotaRows.length > 0 && (
        <div className="institute-quota-strip">
          {quotaRows.map((row) => {
            const percent = row.limit ? clampPercent((row.used / row.limit) * 100) : 0;
            return (
              <div className={`institute-quota-row is-${row.accent}`} key={row.label}>
                <div>
                  <span>{row.label}</span>
                  <strong>{row.limit ? `${row.used}/${row.limit}` : `${row.used} used`}</strong>
                </div>
                <div className="institute-quota-track">
                  <i style={{ width: `${percent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
