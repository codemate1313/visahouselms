import { Button } from "@/components/ui";
import { instructorsStrings as strings } from "../Instructors.strings";

interface InstructorsBulkActionsBarProps {
  selectedCount: number;
  busy: boolean;
  hasInactiveSelected: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export function InstructorsBulkActionsBar({ selectedCount, busy, hasInactiveSelected, onActivate, onDeactivate, onDelete, onClear }: InstructorsBulkActionsBarProps) {
  const t = strings.bulkActions;
  return (
    <div className="bulk-actions-bar">
      <span>
        <strong>{selectedCount}</strong> {t.selectedSuffix}
      </span>
      <div className="bulk-actions-buttons">
        {hasInactiveSelected ? (
          <Button variant="secondary" size="sm" disabled={busy} onClick={onActivate}>
            {t.activate}
          </Button>
        ) : (
          <Button variant="secondary" size="sm" disabled={busy} onClick={onDeactivate}>
            {t.deactivate}
          </Button>
        )}
        <Button variant="danger" size="sm" disabled={busy} onClick={onDelete}>
          {t.delete}
        </Button>
        <Button variant="secondary" size="sm" disabled={busy} onClick={onClear}>
          {t.clear}
        </Button>
      </div>
    </div>
  );
}
