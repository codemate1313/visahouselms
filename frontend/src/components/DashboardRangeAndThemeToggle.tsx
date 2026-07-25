import { type TimeRange, useDashboardRangeStore } from "../store/dashboardRangeStore";
import { ThemeToggle } from "./ThemeToggle";
import "./DashboardRangeAndThemeToggle.css";

export function DashboardRangeAndThemeToggle() {
  const { range, setRange } = useDashboardRangeStore();

  const ranges: TimeRange[] = ["7D", "30D", "90D"];

  return (
    <div className="dash-controls-wrapper">
      {/* Segmented Time-Range Pill Selector */}
      <div className="segmented-range-pill" role="tablist" aria-label="Dashboard time range">
        {ranges.map((r) => {
          const isActive = range === r;
          return (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`range-pill-option ${isActive ? "is-active" : ""}`}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          );
        })}
      </div>

      {/* Theme state now lives in useThemeStore and is applied globally by
          useApplyTheme() at the app root. */}
      <ThemeToggle />
    </div>
  );
}
