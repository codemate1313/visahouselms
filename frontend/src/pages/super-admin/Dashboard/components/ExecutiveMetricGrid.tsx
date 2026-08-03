import { dashboardStrings as strings } from "../Dashboard.strings";
import type { MetricKey, Summary } from "../types";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { formatMoney } from "../helpers";

interface ExecutiveMetricGridProps {
  summary: Summary;
  growth: { rev: string; sub: string; inst: string };
  onOpen: (metric: MetricKey) => void;
}

export function ExecutiveMetricGrid({ summary, growth, onOpen }: ExecutiveMetricGridProps) {
  const { counts, revenue } = summary;
  const t = strings.metricTitles;
  const b = strings.badges;
  const canViewMoney = summary.permissions.can_view_monetary_analytics && revenue !== null;

  if (!canViewMoney) {
    return (
      <div className="executive-metric-grid">
        <MetricCard icon="user" onClick={() => onOpen("students")} label={t.students} value={counts.students_total} badge={b.enrolled} tone="green" />
        <MetricCard icon="building" onClick={() => onOpen("institutes")} label={t.institutes} value={counts.institutes_total} badge={growth.inst} tone="blue" />
        <MetricCard icon="session" onClick={() => onOpen("online_students")} label={t.online_students} value={counts.students_online} badge={b.online} tone="green" />
        <MetricCard icon="grading" onClick={() => onOpen("active_tests")} label={t.active_tests} value={counts.students_giving_tests} badge={b.live} tone="purple" />
      </div>
    );
  }

  return (
    <div className="executive-metric-grid">
      <MetricCard icon="building" onClick={() => onOpen("institutes")} label={t.institutes} value={counts.institutes_total} badge={growth.inst} tone="green" />
      <MetricCard icon="subscription" onClick={() => onOpen("subscriptions")} label={t.subscriptions} value={counts.subscriptions_active} badge={growth.sub} tone="blue" />
      <MetricCard icon="revenue" onClick={() => onOpen("revenue")} label={t.revenue} value={Number(revenue.total_revenue)} valueFormatter={formatMoney} badge={growth.rev} tone="green" />
      <MetricCard icon="due" onClick={() => onOpen("dues")} label={t.dues} value={Number(revenue.total_due)} valueFormatter={formatMoney} valueClassName="due-text" badge={b.pending} tone="amber" />
      <MetricCard icon="transactions" onClick={() => onOpen("transactions")} label={t.transactions} value={revenue.transaction_count} badge={b.settled} tone="slate" />
      <MetricCard icon="instructors" onClick={() => onOpen("instructors")} label={t.instructors} value={counts.sa_instructor_accounts} badge={b.verified} tone="green" />
      <MetricCard icon="module" onClick={() => onOpen("modules")} label={t.modules} value={counts.modules_published} badge={b.published} tone="purple" />
    </div>
  );
}
