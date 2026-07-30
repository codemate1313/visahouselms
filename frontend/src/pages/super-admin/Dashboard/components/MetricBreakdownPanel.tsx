import { SegmentedControl } from "@/components/ui";
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
      <SegmentedControl
        ariaLabel={breakdown.label}
        className="metric-breakdown-tabs"
        onChange={(value) => onSelectKey(value === "__all__" ? null : value)}
        options={[
          { label: `${t.allMethods} (${breakdown.groups.length})`, value: "__all__" },
          ...breakdown.groups.map((group) => ({
            label: `${group.label} (${group.count})`,
            value: group.key,
          })),
        ]}
        size="sm"
        value={selectedKey ?? "__all__"}
      />
    </section>
  );
}
