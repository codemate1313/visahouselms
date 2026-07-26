import { Link } from "react-router-dom";
import { Icon } from "@/components/icons";
import { SearchableSelect, SearchInput } from "@/components/ui";
import { institutesStrings as strings } from "../Institutes.strings";

interface InstitutesFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  subscriptionFilter: string;
  onSubscriptionFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onExportPdf: () => void;
  onExportExcel: () => void;
  resultCount: number;
}

export function InstitutesFilterBar({
  search,
  onSearchChange,
  subscriptionFilter,
  onSubscriptionFilterChange,
  statusFilter,
  onStatusFilterChange,
  onExportPdf,
  onExportExcel,
  resultCount,
}: InstitutesFilterBarProps) {
  const sub = strings.subscriptionFilter;
  const stat = strings.statusFilter;
  const r = strings.resultCount;
  return (
    <div className="filter-bar institutes-filter-bar">
      <SearchInput value={search} onChange={onSearchChange} placeholder={strings.searchPlaceholder} width={260} />

      <SearchableSelect
        options={[
          { value: "", label: sub.allSubscriptions },
          { value: "active", label: sub.active },
          { value: "grace", label: sub.grace },
          { value: "expired", label: sub.expired },
        ]}
        value={subscriptionFilter}
        onChange={(val) => onSubscriptionFilterChange(String(val))}
        placeholder={sub.allSubscriptions}
        searchable={false}
        className="status-filter-select"
      />

      <SearchableSelect
        options={[
          { value: "", label: stat.allStatuses },
          { value: "active", label: stat.active },
          { value: "suspended", label: stat.suspended },
          { value: "draft", label: stat.draft },
        ]}
        value={statusFilter}
        onChange={(val) => onStatusFilterChange(String(val))}
        placeholder={stat.allStatuses}
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

      <Link to="/super-admin/onboarding/new" className="button-link" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <Icon name="plus" />
        <span>{strings.onboardInstitute}</span>
      </Link>

      <div className="filter-result-count">
        {r.showing} <strong>{resultCount}</strong> {resultCount === 1 ? r.entry : r.entries}
      </div>
    </div>
  );
}
