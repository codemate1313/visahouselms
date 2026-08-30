import { Icon } from "@/components/icons";
import type { TargetInstituteOption } from "@/api/types";
import { Button } from "@/components/ui/Button/Button";
import { platformNotificationsStrings as strings } from "../PlatformNotifications.strings";

interface InstituteTargetPickerProps {
  institutes: TargetInstituteOption[];
  selectedIds: number[];
  search: string;
  onSearchChange: (value: string) => void;
  onToggle: (id: number) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

export function InstituteTargetPicker({
  institutes,
  selectedIds,
  search,
  onSearchChange,
  onToggle,
  onSelectAll,
  onClearAll,
}: InstituteTargetPickerProps) {
  const t = strings.publisher;
  return (
    <div className="pn-target-container">
      <div className="pn-target-header">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="building" />
          <span>{t.instituteTargetHeader(selectedIds.length)}</span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {institutes.length > 0 && (
            <Button type="button" variant="text" size="sm" className="pn-text-btn" onClick={onSelectAll}>
              {t.selectAll}
            </Button>
          )}
          {selectedIds.length > 0 && (
            <Button type="button" variant="text" size="sm" className="pn-text-btn" onClick={onClearAll}>
              {t.clearAll}
            </Button>
          )}
        </div>
      </div>
      <input
        type="text"
        className="pn-input pn-target-search"
        placeholder={t.instituteSearchPlaceholder}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <div className="pn-chip-list">
        {institutes.map((inst) => {
          const active = selectedIds.includes(inst.id);
          return (
            <button type="button" key={inst.id} className={`pn-chip ${active ? "is-active" : ""}`} onClick={() => onToggle(inst.id)}>
              <Icon name={active ? "check" : "plus"} />
              <strong>{inst.name}</strong>
            </button>
          );
        })}
      </div>
    </div>
  );
}
