import { Link } from "react-router-dom";
import { superAdminBlogsStrings as strings } from "../SuperAdminBlogs.strings";
import type { BlogStatusFilter, BlogViewMode } from "../types";

interface BlogsToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filterStatus: BlogStatusFilter;
  onFilterStatusChange: (status: BlogStatusFilter) => void;
  viewMode: BlogViewMode;
  onViewModeChange: (mode: BlogViewMode) => void;
}

export function BlogsToolbar({ search, onSearchChange, filterStatus, onFilterStatusChange, viewMode, onViewModeChange }: BlogsToolbarProps) {
  return (
    <div className="sab-toolbar">
      <div className="sab-search-box">
        <svg className="sab-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder={strings.searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="sab-search-input"
        />
      </div>

      <div className="sab-toolbar-actions">
        <div className="sab-filter-group">
          {strings.statusFilters.map((st) => (
            <button key={st} type="button" onClick={() => onFilterStatusChange(st)} className={`sab-filter-btn ${filterStatus === st ? "active" : ""}`}>
              {st}
            </button>
          ))}
        </div>

        <div className="sab-view-group">
          <button type="button" onClick={() => onViewModeChange("grid")} className={`sab-view-btn ${viewMode === "grid" ? "active" : ""}`} title={strings.gridViewTitle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </button>
          <button type="button" onClick={() => onViewModeChange("table")} className={`sab-view-btn ${viewMode === "table" ? "active" : ""}`} title={strings.tableViewTitle}>
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

        <Link to="/super-admin/blogs/new" className="sab-btn sab-btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>{strings.writeBlogPost}</span>
        </Link>
      </div>
    </div>
  );
}
