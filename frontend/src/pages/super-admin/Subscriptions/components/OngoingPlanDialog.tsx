import { Icon } from "@/components/icons";
import { Modal } from "@/components/ui";
import { subscriptionsStrings as strings } from "../Subscriptions.strings";
import { formatDate } from "@/utils/date";

interface OngoingPlanDialogProps {
  busy: boolean;
  expiresAt: string;
  onCancel: () => void;
  onClose: () => void;
  onEdit: () => void;
  onRenew: () => void;
  open: boolean;
  planName: string;
}

export function OngoingPlanDialog({
  busy,
  expiresAt,
  onCancel,
  onClose,
  onEdit,
  onRenew,
  open,
  planName,
}: OngoingPlanDialogProps) {
  const t = strings.ongoingPlanDialog;
  const expiryDate = formatDate(expiresAt);

  function choose(action: () => void) {
    onClose();
    action();
  }

  return (
    <Modal open={open} onClose={onClose} size="sm" title={t.title} className="ongoing-plan-dialog">
      <p className="ongoing-plan-dialog-summary">{t.summary(planName, expiryDate)}</p>

      <div className="ongoing-plan-options">
        <button type="button" className="ongoing-plan-option" disabled={busy} onClick={() => choose(onEdit)}>
          <span className="ongoing-plan-option-icon" aria-hidden="true"><Icon name="edit" /></span>
          <span>
            <strong>{t.editTitle}</strong>
            <small>{t.editDescription}</small>
          </span>
        </button>

        <button type="button" className="ongoing-plan-option" disabled={busy} onClick={() => choose(onRenew)}>
          <span className="ongoing-plan-option-icon" aria-hidden="true"><Icon name="subscription" /></span>
          <span>
            <strong>{t.renewTitle}</strong>
            <small>{t.renewDescription(expiryDate)}</small>
          </span>
        </button>

        <button type="button" className="ongoing-plan-option is-danger" disabled={busy} onClick={() => choose(onCancel)}>
          <span className="ongoing-plan-option-icon" aria-hidden="true"><Icon name="trash" /></span>
          <span>
            <strong>{t.cancelTitle}</strong>
            <small>{t.cancelDescription}</small>
          </span>
        </button>
      </div>
    </Modal>
  );
}
