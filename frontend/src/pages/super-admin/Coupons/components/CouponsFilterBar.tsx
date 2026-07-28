import { Icon } from "@/components/icons";
import { ExportButtons, LinkButton, SearchInput, SearchableSelect } from "@/components/ui";
import { couponsStrings as strings } from "../Coupons.strings";
import { ALL_SCOPES_LABEL, ANY_STATUS_LABEL, BOOLEAN_ACTIVE_OPTIONS, COUPON_SCOPE_OPTIONS } from "@/constants";

interface CouponsFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  scopeFilter: string;
  onScopeFilterChange: (value: string) => void;
  activeFilter: string;
  onActiveFilterChange: (value: string) => void;
  onExportPdf: () => void;
  onExportExcel: () => void;
  resultCount: number;
}

export function CouponsFilterBar({
  search,
  onSearchChange,
  scopeFilter,
  onScopeFilterChange,
  activeFilter,
  onActiveFilterChange,
  onExportPdf,
  onExportExcel,
  resultCount,
}: CouponsFilterBarProps) {
  const r = strings.resultCount;
  return (
    <div className="filter-bar institutes-filter-bar">
      <SearchInput value={search} onChange={onSearchChange} placeholder={strings.searchPlaceholder} width={260} />

      <SearchableSelect
        options={[
          ...COUPON_SCOPE_OPTIONS,
        ]}
        value={scopeFilter}
        onChange={(val) => onScopeFilterChange(String(val))}
        placeholder={ALL_SCOPES_LABEL}
        searchable={false}
        className="status-filter-select"
      />

      <SearchableSelect
        options={[
          ...BOOLEAN_ACTIVE_OPTIONS,
        ]}
        value={activeFilter}
        onChange={(val) => onActiveFilterChange(String(val))}
        placeholder={ANY_STATUS_LABEL}
        searchable={false}
        className="status-filter-select"
      />

      <ExportButtons
        onExportPdf={onExportPdf}
        onExportExcel={onExportExcel}
        pdfLabel={strings.exportPdf}
        excelLabel={strings.exportExcel}
      />

      <LinkButton to="/super-admin/coupons/new">
        <Icon name="plus" />
        <span>{strings.newCoupon}</span>
      </LinkButton>

      <div className="filter-result-count">
        {r.showing} <strong>{resultCount}</strong> {resultCount === 1 ? r.entry : r.entries}
      </div>
    </div>
  );
}
