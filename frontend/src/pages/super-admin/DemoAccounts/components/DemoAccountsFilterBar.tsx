import { Button, ExportButtons, SearchInput, SearchableSelect } from "@/components/ui";
import { demoAccountsStrings as strings } from "../DemoAccounts.strings";
import { Icon } from "@/components/icons";

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

      <ExportButtons
        onExportPdf={onExportPdf}
        onExportExcel={onExportExcel}
        pdfLabel={strings.exportPdf}
        excelLabel={strings.exportExcel}
      />

      <Button
        variant={showForm ? "secondary" : "primary"}
        leftIcon={showForm ? undefined : <Icon name="plus" />}
        onClick={onToggleForm}
      >
        {showForm ? strings.cancel : strings.newDemo}
      </Button>
    </div>
  );
}
