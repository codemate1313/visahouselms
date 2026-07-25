import { Icon } from "@/components/icons";
import { SearchableSelect, SearchInput } from "@/components/ui";
import { demoAccountsStrings as strings } from "../DemoAccounts.strings";

interface DemoAccountsFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  stateFilter: string;
  onStateFilterChange: (value: string) => void;
  onExportPdf: () => void;
  onExportExcel: () => void;
  showForm: boolean;
  onToggleForm: () => void;
}

export function DemoAccountsFilterBar({
  search,
  onSearchChange,
  stateFilter,
  onStateFilterChange,
  onExportPdf,
  onExportExcel,
  showForm,
  onToggleForm,
}: DemoAccountsFilterBarProps) {
  const t = strings.stateFilter;
  return (
    <div className="filter-bar institutes-filter-bar">
      <SearchInput value={search} onChange={onSearchChange} placeholder={strings.searchPlaceholder} width={260} />

      <SearchableSelect
        options={[
          { value: "", label: t.allStates },
          { value: "active", label: t.active },
          { value: "expired", label: t.expired },
          { value: "converted", label: t.converted },
        ]}
        value={stateFilter}
        onChange={(val) => onStateFilterChange(String(val))}
        placeholder={t.allStates}
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

      <button type="button" className={showForm ? "secondary-link-btn" : "button-link"} onClick={onToggleForm}>
        {showForm ? strings.cancel : strings.newDemo}
      </button>
    </div>
  );
}
