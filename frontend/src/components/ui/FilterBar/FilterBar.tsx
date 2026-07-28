import type { ReactNode } from "react";
import "./FilterBar.css";

export interface FilterBarProps {
  children: ReactNode;
  /**
   * Right-aligned result tally, e.g. "Showing 24 entries". Rendered last and
   * pushed to the far edge so every screen reports counts in the same place.
   */
  resultCount?: ReactNode;
  className?: string;
}

/**
 * The toolbar strip above dashboard tables: search box, dropdown filters,
 * export actions and a create button.
 *
 * Exists so the row's layout (gap, wrapping, and the z-index escalation that
 * lets an open dropdown escape the table below) is declared once instead of
 * being re-derived by each page's `.filter-bar` markup.
 */
export function FilterBar({ children, resultCount, className = "" }: FilterBarProps) {
  return (
    <div className={`filter-bar ui-filter-bar ${className}`.trim()}>
      {children}
      {resultCount !== undefined && <div className="filter-result-count">{resultCount}</div>}
    </div>
  );
}
