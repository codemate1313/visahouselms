import { Icon } from "@/components/icons";
import { ExportButtons, LinkButton, SearchInput, SearchableSelect } from "@/components/ui";
import { instituteOnboardingsStrings as strings } from "../InstituteOnboardings.strings";

interface OnboardingsFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onExportPdf: () => void;
  onExportExcel: () => void;
}

export function OnboardingsFilterBar({ search, onSearchChange, statusFilter, onStatusFilterChange, onExportPdf, onExportExcel }: OnboardingsFilterBarProps) {
  const t = strings.statusFilter;
  return (
    <div className="filter-bar institutes-filter-bar">
      <SearchInput value={search} onChange={onSearchChange} placeholder={strings.searchPlaceholder} width={280} />

      <SearchableSelect
        options={[
          { value: "", label: t.allStatuses },
          { value: "published", label: t.published },
          { value: "draft", label: t.draft },
        ]}
        value={statusFilter}
        onChange={(val) => onStatusFilterChange(String(val))}
        placeholder={t.allStatuses}
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
    </div>
  );
}
