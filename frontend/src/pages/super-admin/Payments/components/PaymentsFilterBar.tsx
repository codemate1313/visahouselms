import { ExportButtons, SearchInput, SearchableSelect } from "@/components/ui";
import { paymentsStrings as strings } from "../Payments.strings";
import type { InstituteRow } from "../types";

interface PaymentsFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  institutes: InstituteRow[];
  instituteFilter: string;
  onInstituteFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  onExportPdf: () => void;
  onExportExcel: () => void;
  resultCount: number;
}

export function PaymentsFilterBar({
  search,
  onSearchChange,
  institutes,
  instituteFilter,
  onInstituteFilterChange,
  statusFilter,
  onStatusFilterChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  onExportPdf,
  onExportExcel,
  resultCount,
}: PaymentsFilterBarProps) {
  const t = strings.statusFilter;
  const i = strings.instituteFilter;
  const r = strings.resultCount;
  return (
    <div className="filter-bar institutes-filter-bar">
      <SearchInput value={search} onChange={onSearchChange} placeholder={strings.searchPlaceholder} width={260} />

      <SearchableSelect
        options={[
          { value: "", label: i.allInstitutes },
          ...institutes.map((inst) => ({ value: String(inst.id), label: inst.name })),
        ]}
        value={instituteFilter}
        onChange={(val) => onInstituteFilterChange(String(val))}
        placeholder={i.allInstitutes}
        searchPlaceholder={i.search}
        className="status-filter-select"
      />

      <SearchableSelect
        options={[
          { value: "", label: t.allStatuses },
          { value: "paid", label: t.paid },
          { value: "partial", label: t.partial },
          { value: "pending", label: t.pending },
          { value: "failed", label: t.failed },
          { value: "refunded", label: t.refunded },
        ]}
        value={statusFilter}
        onChange={(val) => onStatusFilterChange(String(val))}
        placeholder={t.allStatuses}
        searchable={false}
        className="status-filter-select"
      />

      <div className="date-filter-wrap">
        <input type="date" value={dateFrom} onChange={(e) => onDateFromChange(e.target.value)} className="date-input-field" aria-label={strings.dateFrom} />
        <span className="date-sep-text">{strings.dateSeparator}</span>
        <input type="date" value={dateTo} onChange={(e) => onDateToChange(e.target.value)} className="date-input-field" aria-label={strings.dateTo} />
      </div>

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
