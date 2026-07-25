import { superAdminTestimonialsStrings as strings } from "../SuperAdminTestimonials.strings";
import type { TestimonialStatusFilter, TestimonialViewMode } from "../types";

interface TestimonialsToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filterStatus: TestimonialStatusFilter;
  onFilterStatusChange: (status: TestimonialStatusFilter) => void;
  viewMode: TestimonialViewMode;
  onViewModeChange: (mode: TestimonialViewMode) => void;
  onAdd: () => void;
}

export function TestimonialsToolbar({
  search,
  onSearchChange,
  filterStatus,
  onFilterStatusChange,
  viewMode,
  onViewModeChange,
  onAdd,
}: TestimonialsToolbarProps) {
  return (
    <div className="sat-toolbar">
      <div className="sat-search-box">
        <svg className="sat-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder={strings.searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="sat-search-input"
        />
      </div>

      <div className="sat-toolbar-actions">
        <div className="sat-filter-group">
          {strings.statusFilters.map((st) => (
            <button key={st} type="button" onClick={() => onFilterStatusChange(st)} className={`sat-filter-btn ${filterStatus === st ? "active" : ""}`}>
              {st}
            </button>
          ))}
        </div>

        <div className="sat-view-group">
          <button type="button" onClick={() => onViewModeChange("grid")} className={`sat-view-btn ${viewMode === "grid" ? "active" : ""}`} title={strings.gridViewTitle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </button>
          <button type="button" onClick={() => onViewModeChange("table")} className={`sat-view-btn ${viewMode === "table" ? "active" : ""}`} title={strings.tableViewTitle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
        </div>

        <button type="button" onClick={onAdd} className="sat-btn sat-btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>{strings.addTestimonial}</span>
        </button>
      </div>
    </div>
  );
}
