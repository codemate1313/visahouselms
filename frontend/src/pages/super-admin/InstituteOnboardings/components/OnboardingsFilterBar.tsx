import { Link } from "react-router-dom";
import { Icon } from "@/components/icons";
import { SearchableSelect, SearchInput } from "@/components/ui";
import { instituteOnboardingsStrings as strings } from "../InstituteOnboardings.strings";

interface OnboardingsFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onExportPdf: () => void;
  onExportExcel: () => void;
}

export function OnboardingsFilterBar({ search, onSearchChange, statusFilter, onStatusFilterChange, onExportPdf, onExportExcel }: OnboardingsFilterBarProps) {
  const t = strings.statusFilter;
  return (
    <div className="filter-bar institutes-filter-bar">
      <SearchInput value={search} onChange={onSearchChange} placeholder={strings.searchPlaceholder} width={280} />

      <SearchableSelect
        options={[
          { value: "", label: t.allStatuses },
          { value: "published", label: t.published },
          { value: "draft", label: t.draft },
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

      <Link className="button-link" to="/super-admin/onboarding/new">
        {strings.onboardInstitute}
      </Link>
    </div>
  );
}
