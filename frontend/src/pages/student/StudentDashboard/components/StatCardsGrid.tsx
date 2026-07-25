import { STAT_ICONS } from "../icons";

export interface StatCard {
  key: string;
  label: string;
  value: number;
  tone: string;
}

interface StatCardsGridProps {
  stats: StatCard[];
}

export function StatCardsGrid({ stats }: StatCardsGridProps) {
  return (
    <div className="sd-stat-grid">
      {stats.map((stat) => (
        <div className="sd-stat-card" data-tone={stat.tone} key={stat.key}>
          <div className="sd-stat-content">
            <p className="sd-stat-value" data-value={stat.value}>
              0
            </p>
            <p className="sd-stat-label">{stat.label}</p>
          </div>
          <span className="sd-stat-icon">{STAT_ICONS[stat.key]}</span>
        </div>
      ))}
    </div>
  );
}
