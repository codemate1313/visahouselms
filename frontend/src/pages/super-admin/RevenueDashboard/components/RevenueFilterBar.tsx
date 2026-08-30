import { ExportButtons, SearchableSelect } from "@/components/ui";
import { Button } from "@/components/ui/Button/Button";
import { revenueDashboardStrings as strings } from "../RevenueDashboard.strings";
import type { InstituteRow, MethodRow } from "../types";

interface RevenueFilterBarProps {
  institutes: InstituteRow[];
  instituteFilter: string;
  onInstituteFilterChange: (value: string) => void;
  methods: MethodRow[];
  methodFilter: string;
  onMethodFilterChange: (value: string) => void;
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
  methods,
  methodFilter,
  onMethodFilterChange,
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

      <SearchableSelect
        options={[
          { value: "", label: strings.allMethods },
          ...methods.map((m) => ({ value: String(m.id), label: m.name })),
        ]}
        value={methodFilter}
        onChange={(val) => onMethodFilterChange(String(val))}
        placeholder={strings.allMethods}
        searchPlaceholder={strings.searchMethod}
        className="status-filter-select"
      />

      <div className="date-filter-wrap">
        <input type="date" value={dateFrom} onChange={(e) => onDateFromChange(e.target.value)} className="date-input-field" aria-label={strings.dateFrom} />
        <span className="date-sep-text">{strings.dateSeparator}</span>
        <input type="date" value={dateTo} onChange={(e) => onDateToChange(e.target.value)} className="date-input-field" aria-label={strings.dateTo} />
      </div>

      {(instituteFilter || methodFilter || dateFrom || dateTo) && (
        <Button type="button" variant="secondary" className="clear-search-btn reset-filters-btn" onClick={onResetFilters}>
          {strings.resetFilters}
        </Button>
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
