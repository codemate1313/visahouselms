import { useEffect, useState } from "react";
import { type TimeRange, useDashboardRangeStore } from "../store/dashboardRangeStore";
import "./DashboardRangeAndThemeToggle.css";

export function DashboardRangeAndThemeToggle() {
  const { range, setRange } = useDashboardRangeStore();
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      const saved = localStorage.getItem("vh-theme");
      if (saved === "light" || saved === "dark") return saved;
      const docTheme = document.documentElement.getAttribute("data-theme");
      if (docTheme === "light" || docTheme === "dark") return docTheme;
      return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.body.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("vh-theme", theme);
    } catch {}
    window.dispatchEvent(new CustomEvent("vh-theme-change", { detail: theme }));
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

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

      {/* Circular Theme Toggle Button */}
      <button
        type="button"
        className="dash-theme-toggle-btn"
        onClick={toggleTheme}
        title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      >
        {theme === "light" ? (
          /* Sun Icon */
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        ) : (
          /* Moon Icon */
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </button>
    </div>
  );
}
