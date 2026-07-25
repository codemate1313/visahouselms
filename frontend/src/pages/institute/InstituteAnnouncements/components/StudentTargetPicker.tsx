import type { TargetStudentOption } from "@/api/types";
import { instituteAnnouncementsStrings as strings } from "../InstituteAnnouncements.strings";

interface StudentTargetPickerProps {
  students: TargetStudentOption[];
  selectedIds: number[];
  search: string;
  onSearchChange: (value: string) => void;
  onToggle: (id: number) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

export function StudentTargetPicker({ students, selectedIds, search, onSearchChange, onToggle, onSelectAll, onClearAll }: StudentTargetPickerProps) {
  const t = strings.publisher;
  return (
    <div className="custom-target-select-container">
      <div className="custom-target-header">
        <span>{t.targetHeader(selectedIds.length)}</span>
        <div style={{ display: "flex", gap: 12 }}>
          {students.length > 0 && (
            <button type="button" className="text-button" onClick={onSelectAll}>
              {t.selectAll}
            </button>
          )}
          {selectedIds.length > 0 && (
            <button type="button" className="text-button" onClick={onClearAll}>
              {t.clearAll}
            </button>
          )}
        </div>
      </div>
      <input type="text" className="target-search-input" placeholder={t.searchPlaceholder} value={search} onChange={(e) => onSearchChange(e.target.value)} />
      <div className="chip-select-list">
        {students.map((st) => {
          const active = selectedIds.includes(st.id);
          return (
            <button type="button" key={st.id} className={`chip-option ${active ? "active" : ""}`} onClick={() => onToggle(st.id)}>
              <span>{active ? "✓" : "+"}</span>
              <strong>{st.name}</strong>
              <small>{st.email}</small>
            </button>
          );
        })}
        {students.length === 0 && <small className="help-text">{t.noMatchingStudents}</small>}
      </div>
    </div>
  );
}
