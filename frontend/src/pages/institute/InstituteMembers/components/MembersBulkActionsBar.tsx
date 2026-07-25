import { Button } from "@/components/ui";
import { instituteMembersStrings as strings } from "../InstituteMembers.strings";

interface MembersBulkActionsBarProps {
  selectedCount: number;
  busy: boolean;
  hasInactiveSelected: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export function MembersBulkActionsBar({
  selectedCount,
  busy,
  hasInactiveSelected,
  onActivate,
  onDeactivate,
  onDelete,
  onClear,
}: MembersBulkActionsBarProps) {
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
