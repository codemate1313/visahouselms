import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@/components/icons";
import { SearchableSelect, SearchInput } from "@/components/ui";
import { instructorsStrings as strings } from "../Instructors.strings";

interface InstructorsFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onExportPdf: () => void;
  onExportExcel: () => void;
  resultCount: number;
  onSubmit: (event: FormEvent) => void;
}

export function InstructorsFilterBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onExportPdf,
  onExportExcel,
  resultCount,
  onSubmit,
}: InstructorsFilterBarProps) {
  const t = strings.statusFilter;
  const r = strings.resultCount;
  return (
    <form className="filter-bar institutes-filter-bar" onSubmit={onSubmit}>
      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder={strings.searchPlaceholder}
        aria-label={strings.searchAriaLabel}
        width={260}
      />

      <SearchableSelect
        options={[
          { value: "all", label: t.allStatuses },
          { value: "active", label: t.active },
          { value: "inactive", label: t.inactive },
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

      <Link to="/super-admin/instructors/new" className="button-link">
        {strings.newInstructor}
      </Link>

      <div className="filter-result-count">
        {r.showing} <strong>{resultCount}</strong> {resultCount === 1 ? r.entry : r.entries}
      </div>
    </form>
  );
}
