import { Link } from "react-router-dom";
import { Icon } from "@/components/icons";
import { SearchableSelect, SearchInput } from "@/components/ui";
import { plansStrings as strings } from "../Plans.strings";

interface PlansFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onExportPdf: () => void;
  onExportExcel: () => void;
  resultCount: number;
  /** Create route for the catalogue being listed. */
  newPlanPath: string;
  newPlanLabel: string;
}

export function PlansFilterBar({ search, onSearchChange, statusFilter, onStatusFilterChange, onExportPdf, onExportExcel, resultCount, newPlanPath, newPlanLabel }: PlansFilterBarProps) {
  const t = strings.statusFilter;
  const r = strings.resultCount;
  return (
    <div className="filter-bar institutes-filter-bar">
      <SearchInput value={search} onChange={onSearchChange} placeholder={strings.searchPlaceholder} width={280} />

      <SearchableSelect
        options={[
          { value: "", label: t.allStatuses },
          { value: "active", label: t.active },
          { value: "draft", label: t.draft },
          { value: "inactive", label: t.inactive },
        ]}
        value={statusFilter}
        onChange={(val) => onStatusFilterChange(String(val))}
        placeholder={t.allStatuses}
        searchable={false}
        className="status-filter-select"
      />

      <div className="export-btn-group">
        <button type="button" className="export-btn export-pdf" onClick={onExportPdf} data-tooltip={strings.exportPdf}>
          <Icon name="filePdf" />
        </button>
        <button type="button" className="export-btn export-excel" onClick={onExportExcel} data-tooltip={strings.exportExcel}>
          <Icon name="spreadsheet" />
        </button>
      </div>

      <Link to={newPlanPath} className="button-link">
        {newPlanLabel}
      </Link>

      <div className="filter-result-count">
        {r.showing} <strong>{resultCount}</strong> {resultCount === 1 ? r.entry : r.entries}
      </div>
    </div>
  );
}
