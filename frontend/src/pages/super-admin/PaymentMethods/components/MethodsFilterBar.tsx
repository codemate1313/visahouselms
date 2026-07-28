import { ExportButtons, SearchInput, SearchableSelect } from "@/components/ui";
import { paymentMethodsStrings as strings } from "../PaymentMethods.strings";
import { ACTIVATION_STATUS_OPTIONS, ALL_STATUSES_LABEL } from "@/constants";

interface MethodsFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onExportPdf: () => void;
  onExportExcel: () => void;
  resultCount: number;
}

export function MethodsFilterBar({ search, onSearchChange, statusFilter, onStatusFilterChange, onExportPdf, onExportExcel, resultCount }: MethodsFilterBarProps) {
  const r = strings.resultCount;
  return (
    <div className="filter-bar institutes-filter-bar">
      <SearchInput value={search} onChange={onSearchChange} placeholder={strings.searchPlaceholder} width={280} />

      <SearchableSelect
        options={[
          ...ACTIVATION_STATUS_OPTIONS,
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

      <div className="filter-result-count">
        {r.showing} <strong>{resultCount}</strong> {resultCount === 1 ? r.entry : r.entries}
      </div>
    </div>
  );
}
