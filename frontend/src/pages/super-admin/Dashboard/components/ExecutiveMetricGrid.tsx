import { dashboardStrings as strings } from "../Dashboard.strings";
import type { MetricKey, Summary } from "../types";
import { MetricItem } from "./MetricItem";

interface ExecutiveMetricGridProps {
  summary: Summary;
  growth: { rev: string; sub: string; inst: string };
  onOpen: (metric: MetricKey) => void;
}

export function ExecutiveMetricGrid({ summary, growth, onOpen }: ExecutiveMetricGridProps) {
  const { counts, revenue } = summary;
  const t = strings.metricTitles;
  const b = strings.badges;
  return (
    <div className="executive-metric-grid">
      <MetricItem metricKey="institutes" iconName="building" onOpen={onOpen} label={t.institutes} numericValue={counts.institutes_total} badgeText={growth.inst} badgeTheme="green" />
      <MetricItem metricKey="subscriptions" iconName="subscription" onOpen={onOpen} label={t.subscriptions} numericValue={counts.subscriptions_active} badgeText={growth.sub} badgeTheme="blue" />
      <MetricItem metricKey="revenue" iconName="revenue" onOpen={onOpen} label={t.revenue} numericValue={Number(revenue.total_revenue)} isCurrency badgeText={growth.rev} badgeTheme="green" />
      <MetricItem metricKey="dues" iconName="due" onOpen={onOpen} label={t.dues} numericValue={Number(revenue.total_due)} isCurrency valueClassName="due-text" badgeText={b.pending} badgeTheme="amber" />
      <MetricItem metricKey="transactions" iconName="transactions" onOpen={onOpen} label={t.transactions} numericValue={revenue.transaction_count} badgeText={b.settled} badgeTheme="slate" />
      <MetricItem metricKey="demos" iconName="demo" onOpen={onOpen} label={t.demos} numericValue={counts.demo_accounts_active} badgeText={b.demo} badgeTheme="blue" />
      <MetricItem metricKey="instructors" iconName="instructors" onOpen={onOpen} label={t.instructors} numericValue={counts.sa_instructor_accounts} badgeText={b.verified} badgeTheme="green" />
      <MetricItem metricKey="modules" iconName="module" onOpen={onOpen} label={t.modules} numericValue={counts.modules_published} badgeText={b.published} badgeTheme="purple" />
    </div>
  );
}
