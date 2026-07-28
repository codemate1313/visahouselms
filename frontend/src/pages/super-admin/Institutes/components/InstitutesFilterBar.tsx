import { Icon } from "@/components/icons";
import { ExportButtons, LinkButton, SearchInput, SearchableSelect } from "@/components/ui";
import { institutesStrings as strings } from "../Institutes.strings";
import { ALL_STATUSES_LABEL, ALL_SUBSCRIPTIONS_LABEL, INSTITUTE_STATUS_OPTIONS, SUBSCRIPTION_STATUS_OPTIONS } from "@/constants";

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
  const r = strings.resultCount;
  return (
    <div className="filter-bar institutes-filter-bar">
      <SearchInput value={search} onChange={onSearchChange} placeholder={strings.searchPlaceholder} width={260} />

      <SearchableSelect
        options={[
          ...SUBSCRIPTION_STATUS_OPTIONS,
        ]}
        value={subscriptionFilter}
        onChange={(val) => onSubscriptionFilterChange(String(val))}
        placeholder={ALL_SUBSCRIPTIONS_LABEL}
        searchable={false}
        className="status-filter-select"
      />

      <SearchableSelect
        options={[
          ...INSTITUTE_STATUS_OPTIONS,
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

      <LinkButton to="/super-admin/onboarding/new" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <Icon name="plus" />
        <span>{strings.onboardInstitute}</span>
      </LinkButton>

      <div className="filter-result-count">
        {r.showing} <strong>{resultCount}</strong> {resultCount === 1 ? r.entry : r.entries}
      </div>
    </div>
  );
}
