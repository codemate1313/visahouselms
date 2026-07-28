import { Icon } from "@/components/icons";
import type { TargetStudentOption } from "@/api/types";
import { platformNotificationsStrings as strings } from "../PlatformNotifications.strings";

interface StudentTargetPickerProps {
  students: TargetStudentOption[];
  selectedIds: number[];
  search: string;
  onSearchChange: (value: string) => void;
  onToggle: (id: number) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

export function StudentTargetPicker({
  students,
  selectedIds,
  search,
  onSearchChange,
  onToggle,
  onSelectAll,
  onClearAll,
}: StudentTargetPickerProps) {
  const t = strings.publisher;
  return (
    <div className="pn-target-container">
      <div className="pn-target-header">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="user" />
          <span>{t.studentTargetHeader(selectedIds.length)}</span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {students.length > 0 && (
            <button type="button" className="pn-text-btn" onClick={onSelectAll}>
              {t.selectAll}
            </button>
          )}
          {selectedIds.length > 0 && (
            <button type="button" className="pn-text-btn" onClick={onClearAll}>
              {t.clearAll}
            </button>
          )}
        </div>
      </div>
      <input
        type="text"
        className="pn-input pn-target-search"
        placeholder={t.studentSearchPlaceholder}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <div className="pn-chip-list">
        {students.map((st) => {
          const active = selectedIds.includes(st.id);
          return (
            <button type="button" key={st.id} className={`pn-chip ${active ? "is-active" : ""}`} onClick={() => onToggle(st.id)}>
              <Icon name={active ? "check" : "plus"} />
              <strong>{st.name}</strong>
            </button>
          );
        })}
      </div>
    </div>
  );
}
