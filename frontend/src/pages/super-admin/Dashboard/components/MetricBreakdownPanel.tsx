import { dashboardStrings as strings } from "../Dashboard.strings";
import type { MetricBreakdown } from "../types";

interface MetricBreakdownPanelProps {
  breakdown: MetricBreakdown;
  /** Currently isolated group, or null for "everything". */
  selectedKey: string | null;
  onSelectKey: (key: string | null) => void;
}

export function MetricBreakdownPanel({ breakdown, selectedKey, onSelectKey }: MetricBreakdownPanelProps) {
  const t = strings.breakdownPanel;

  if (!breakdown.groups.length) return null;

  return (
    <section className="metric-breakdown" aria-label={breakdown.label}>
      <div className="tab-bar metric-breakdown-tabs" role="tablist" aria-label={breakdown.label}>
        <button
          type="button"
          role="tab"
          aria-selected={selectedKey === null}
          className={`tab ${selectedKey === null ? "active" : ""}`}
          onClick={() => onSelectKey(null)}
        >
          {t.allMethods} ({breakdown.groups.length})
        </button>
        {breakdown.groups.map((group) => (
          <button
            key={group.key}
            type="button"
            role="tab"
            aria-selected={selectedKey === group.key}
            className={`tab ${selectedKey === group.key ? "active" : ""}`}
            onClick={() => onSelectKey(group.key)}
          >
            {group.label} ({group.count})
          </button>
        ))}
      </div>
    </section>
  );
}
