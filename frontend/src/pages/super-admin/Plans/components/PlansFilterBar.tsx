import { Icon } from "@/components/icons";
import { ExportButtons, LinkButton, SearchInput, SearchableSelect } from "@/components/ui";
import { plansStrings as strings } from "../Plans.strings";
import { ALL_STATUSES_LABEL, CATALOGUE_STATUS_OPTIONS } from "@/constants";

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
  const r = strings.resultCount;
  return (
    <div className="filter-bar institutes-filter-bar">
      <SearchInput value={search} onChange={onSearchChange} placeholder={strings.searchPlaceholder} width={280} />

      <SearchableSelect
        options={[
          ...CATALOGUE_STATUS_OPTIONS,
        ]}
        value={statusFilter}
        onChange={(val) => onStatusFilterChange(String(val))}
        placeholder={ALL_STATUSES_LABEL}
        searchable={false}
        className="status-filter-select"
      />

      <ExportButtons
        onExportPdf={onExportPdf}
        onExportExcel={onExportExcel}
        pdfLabel={strings.exportPdf}
        excelLabel={strings.exportExcel}
      />

      <LinkButton to={newPlanPath}>
        <Icon name="plus" />
        <span>{newPlanLabel}</span>
      </LinkButton>

      <div className="filter-result-count">
        {r.showing} <strong>{resultCount}</strong> {resultCount === 1 ? r.entry : r.entries}
      </div>
    </div>
  );
}
