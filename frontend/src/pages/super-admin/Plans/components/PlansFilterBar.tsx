import { Icon } from "@/components/icons";
import { ExportButtons, LinkButton, SearchInput, SearchableSelect } from "@/components/ui";
import { ToggleSwitch } from "@/components/ToggleSwitch";
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
  /** Show on website visibility toggle props */
  visible: boolean;
  visibilityLoaded: boolean;
  visibilitySaving: boolean;
  onVisibilityChange: (visible: boolean) => void;
  visibilityHint?: string;
}

export function PlansFilterBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onExportPdf,
  onExportExcel,
  resultCount,
  newPlanPath,
  newPlanLabel,
  visible,
  visibilityLoaded,
  visibilitySaving,
  onVisibilityChange,
  visibilityHint,
}: PlansFilterBarProps) {
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

      <LinkButton to={newPlanPath} leftIcon={<Icon name="plus" />}>
        {newPlanLabel}
      </LinkButton>

      <div
        className="filter-visibility-control"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          marginLeft: "auto",
          padding: "4px 12px",
          borderRadius: 10,
          backgroundColor: "var(--card-hover, rgba(0, 0, 0, 0.02))",
          border: "1px solid var(--border)",
        }}
        title={visibilityHint || strings.visibility.tooltip}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap" }}>
          {strings.visibility.label}
        </span>
        <ToggleSwitch
          checked={visible}
          onChange={() => onVisibilityChange(!visible)}
          disabled={visibilitySaving || !visibilityLoaded}
          tooltip={strings.visibility.tooltip}
        />
      </div>

      <div className="filter-result-count">
        {r.showing} <strong>{resultCount}</strong> {resultCount === 1 ? r.entry : r.entries}
      </div>
    </div>
  );
}
