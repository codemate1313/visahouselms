import { Icon } from "@/components/icons";
import { Button, Modal } from "@/components/ui";
import type { InstituteAllocation } from "@/pages/super-admin/InstituteForm/types";
import { subscriptionsStrings as strings } from "../Subscriptions.strings";

interface PlanRenewalDialogProps {
  allocation: InstituteAllocation | null;
  busy: boolean;
  mode: "renew" | "restart";
  nextStartDate: string | null;
  onClose: () => void;
  onConfirm: () => void;
  onEdit: () => void;
  open: boolean;
  planName: string;
}

export function PlanRenewalDialog({
  allocation,
  busy,
  mode,
  nextStartDate,
  onClose,
  onConfirm,
  onEdit,
  open,
  planName,
}: PlanRenewalDialogProps) {
  const t = strings.renewalDialog;
  const isRestart = mode === "restart";
  const startsOn = isRestart || !nextStartDate
    ? t.today
    : new Date(nextStartDate).toLocaleDateString("en-GB");

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={isRestart ? t.restartTitle : t.renewTitle}
      className="plan-renewal-dialog"
      actions={(
        <>
          <Button
            variant="secondary"
            disabled={busy}
            leftIcon={<Icon name="edit" />}
            onClick={onEdit}
          >
            {t.editBefore}
          </Button>
          <Button
            loading={busy}
            leftIcon={<Icon name="subscription" />}
            onClick={onConfirm}
          >
            {isRestart ? t.restartSamePlan : t.renewSamePlan}
          </Button>
        </>
      )}
    >
      <p className="plan-renewal-intro">
        {isRestart ? t.restartDescription : t.renewDescription}
      </p>

      <dl className="plan-renewal-details">
        <div>
          <dt>{t.plan}</dt>
          <dd>{planName}</dd>
        </div>
        <div>
          <dt>{t.starts}</dt>
          <dd>{startsOn}</dd>
        </div>
        <div>
          <dt>{t.duration}</dt>
          <dd>{allocation ? t.days(allocation.duration_days) : t.notAvailable}</dd>
        </div>
        <div>
          <dt>{t.grace}</dt>
          <dd>{allocation ? t.days(allocation.grace_days) : t.notAvailable}</dd>
        </div>
        <div>
          <dt>{t.students}</dt>
          <dd>{allocation?.student_limit ?? t.notAvailable}</dd>
        </div>
        <div>
          <dt>{t.instructors}</dt>
          <dd>{allocation?.staff_limit ?? t.notAvailable}</dd>
        </div>
        <div>
          <dt>{t.courses}</dt>
          <dd>{allocation?.module_count ?? t.notAvailable}</dd>
        </div>
        <div>
          <dt>{t.tests}</dt>
          <dd>{t.unlimited}</dd>
        </div>
      </dl>

      <p className="plan-renewal-note">
        {isRestart ? t.restartNote : t.renewNote}
      </p>
    </Modal>
  );
}
