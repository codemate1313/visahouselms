import { Link } from "react-router-dom";
import { Icon } from "@/components/icons";
import { SearchableSelect, SearchInput } from "@/components/ui";
import { couponsStrings as strings } from "../Coupons.strings";

interface CouponsFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  scopeFilter: string;
  onScopeFilterChange: (value: string) => void;
  activeFilter: string;
  onActiveFilterChange: (value: string) => void;
  onExportPdf: () => void;
  onExportExcel: () => void;
  resultCount: number;
}

export function CouponsFilterBar({
  search,
  onSearchChange,
  scopeFilter,
  onScopeFilterChange,
  activeFilter,
  onActiveFilterChange,
  onExportPdf,
  onExportExcel,
  resultCount,
}: CouponsFilterBarProps) {
  const s = strings.scopeFilter;
  const t = strings.statusFilter;
  const r = strings.resultCount;
  return (
    <div className="filter-bar institutes-filter-bar">
      <SearchInput value={search} onChange={onSearchChange} placeholder={strings.searchPlaceholder} width={260} />

      <SearchableSelect
        options={[
          { value: "", label: s.allScopes },
          { value: "all", label: s.allPlans },
          { value: "plan", label: s.specificPlan },
          { value: "course", label: s.specificCourse },
        ]}
        value={scopeFilter}
        onChange={(val) => onScopeFilterChange(String(val))}
        placeholder={s.allScopes}
        searchable={false}
        className="status-filter-select"
      />

      <SearchableSelect
        options={[
          { value: "", label: t.anyStatus },
          { value: "true", label: t.active },
          { value: "false", label: t.inactive },
        ]}
        value={activeFilter}
        onChange={(val) => onActiveFilterChange(String(val))}
        placeholder={t.anyStatus}
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

      <Link to="/super-admin/coupons/new" className="button-link">
        {strings.newCoupon}
      </Link>

      <div className="filter-result-count">
        {r.showing} <strong>{resultCount}</strong> {resultCount === 1 ? r.entry : r.entries}
      </div>
    </div>
  );
}
