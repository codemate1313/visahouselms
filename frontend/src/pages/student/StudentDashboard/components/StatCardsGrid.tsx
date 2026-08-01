import { MetricCard, type MetricCardTone } from "@/components/dashboard/MetricCard";
import { STAT_ICONS } from "../icons";

export interface StatCard {
  key: string;
  label: string;
  value: number;
  tone: MetricCardTone;
  caption?: string;
  onClick?: () => void;
}

interface StatCardsGridProps {
  stats: StatCard[];
}

export function StatCardsGrid({ stats }: StatCardsGridProps) {
  return (
    <div className="metric-grid">
      {stats.map((stat) => (
        <MetricCard
          iconNode={STAT_ICONS[stat.key]}
          key={stat.key}
          label={stat.label}
          value={stat.value}
          tone={stat.tone}
          caption={stat.caption}
          onClick={stat.onClick}
        />
      ))}
    </div>
  );
}
