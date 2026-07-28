import { ExportButtons, SearchableSelect } from "@/components/ui";
import { revenueDashboardStrings as strings } from "../RevenueDashboard.strings";
import type { InstituteRow } from "../types";

interface RevenueFilterBarProps {
  institutes: InstituteRow[];
  instituteFilter: string;
  onInstituteFilterChange: (value: string) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  onResetFilters: () => void;
  onExportPdf: () => void;
  onExportExcel: () => void;
  transactionCount: number;
}

export function RevenueFilterBar({
  institutes,
  instituteFilter,
  onInstituteFilterChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  onResetFilters,
  onExportPdf,
  onExportExcel,
  transactionCount,
}: RevenueFilterBarProps) {
  const r = strings.resultCount;
  return (
    <div className="filter-bar institutes-filter-bar">
      <SearchableSelect
        options={[
          { value: "", label: strings.allInstitutes },
          ...institutes.map((i) => ({ value: String(i.id), label: i.name })),
        ]}
        value={instituteFilter}
        onChange={(val) => onInstituteFilterChange(String(val))}
        placeholder={strings.allInstitutes}
        searchPlaceholder={strings.searchInstitute}
        className="status-filter-select"
      />

      <div className="date-filter-wrap">
        <input type="date" value={dateFrom} onChange={(e) => onDateFromChange(e.target.value)} className="date-input-field" aria-label={strings.dateFrom} />
        <span className="date-sep-text">{strings.dateSeparator}</span>
        <input type="date" value={dateTo} onChange={(e) => onDateToChange(e.target.value)} className="date-input-field" aria-label={strings.dateTo} />
      </div>

      {(instituteFilter || dateFrom || dateTo) && (
        <button type="button" className="clear-search-btn reset-filters-btn" onClick={onResetFilters}>
          {strings.resetFilters}
        </button>
      )}

      <ExportButtons
        onExportPdf={onExportPdf}
        onExportExcel={onExportExcel}
        pdfLabel={strings.exportPdf}
        excelLabel={strings.exportExcel}
      />

      <div className="filter-result-count">
        {r.showing} <strong>{transactionCount}</strong> {transactionCount === 1 ? r.transaction : r.transactions}
      </div>
    </div>
  );
}
