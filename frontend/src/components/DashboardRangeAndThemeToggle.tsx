import { type TimeRange, useDashboardRangeStore } from "../store/dashboardRangeStore";
import { SegmentedControl } from "./ui";
import "./DashboardRangeAndThemeToggle.css";

export function DashboardRangeAndThemeToggle() {
  const { range, setRange } = useDashboardRangeStore();

  const ranges: TimeRange[] = ["7D", "30D", "90D"];

  return (
    <div className="dash-controls-wrapper">
      <SegmentedControl
        ariaLabel="Dashboard time range"
        onChange={setRange}
        options={ranges.map((value) => ({ label: value, value }))}
        size="sm"
        value={range}
      />
    </div>
  );
}
