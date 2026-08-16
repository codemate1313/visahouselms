import { Button } from "@/components/ui";
import { instituteMembersStrings as strings } from "../InstituteMembers.strings";

interface MembersBulkActionsBarProps {
  selectedCount: number;
  busy: boolean;
  hasInactiveSelected: boolean;
  /** How many of the selected rows are students whose seat can be freed -
   *  expired or deactivated. Zero hides the button rather than showing one
   *  that would only ever return an error. */
  reclaimableCount: number;
  onActivate: () => void;
  onDeactivate: () => void;
  onFreeSeats: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export function MembersBulkActionsBar({
  selectedCount,
  busy,
  hasInactiveSelected,
  reclaimableCount,
  onActivate,
  onDeactivate,
  onFreeSeats,
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
        {reclaimableCount > 0 && (
          <Button variant="secondary" size="sm" disabled={busy} onClick={onFreeSeats}>
            {t.freeSeats} ({reclaimableCount})
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
