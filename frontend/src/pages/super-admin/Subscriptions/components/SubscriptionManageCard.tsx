import { useState } from "react";
import { allocationSummaryLine, type InstituteAllocation } from "@/pages/super-admin/InstituteForm/types";
import { subscriptionsStrings as strings } from "../Subscriptions.strings";
import { STATE_BADGES, stateLabel } from "../helpers";
import type { InstituteRow, StatusResponse, SubscriptionInfo } from "../types";
import { QuotaPieChart } from "./QuotaPieChart";
import { ValidityGauge } from "./ValidityGauge";
import { Button } from "@/components/ui";
import { Icon } from "@/components/icons";
import { OngoingPlanDialog } from "./OngoingPlanDialog";
import { PlanRenewalDialog } from "./PlanRenewalDialog";
import {
  PlanEditDialog,
  type InstitutePlanEditValues,
} from "./PlanEditDialog";
import type { AgreementAttachment } from "@/pages/super-admin/InstituteForm/components/AgreementAttachments";
import { formatDate } from "@/utils/date";

interface SubscriptionManageCardProps {
  status: StatusResponse;
  selectedInstitute: InstituteRow;
  /** The institute's provisions, or null if nothing is allocated yet. */
  allocation: InstituteAllocation | null;
  agreementDocument: AgreementAttachment | null;
  busy: boolean;
  cancelledSubscription: SubscriptionInfo | null;
  planEditValues: InstitutePlanEditValues | null;
  onAssign: () => void;
  onDownloadAttachment: (attachment: AgreementAttachment) => void;
  onEditPlan: (
    values: InstitutePlanEditValues,
    files: { agreementDocument: File | null; paymentProof: File | null },
  ) => Promise<boolean>;
  onRemoveAttachment: (kind: "agreement" | "payment-proof") => void;
  onRenew: (planId: number) => void;
  onRestart: (planId: number) => void;
  onCancel: (subscriptionId: number) => void;
  paymentProof: AgreementAttachment | null;
}

export function SubscriptionManageCard({
  status,
  selectedInstitute,
  allocation,
  agreementDocument,
  busy,
  cancelledSubscription,
  planEditValues,
  onAssign,
  onDownloadAttachment,
  onEditPlan,
  onRemoveAttachment,
  onRenew,
  onRestart,
  onCancel,
  paymentProof,
}: SubscriptionManageCardProps) {
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [renewalMode, setRenewalMode] = useState<"renew" | "restart" | null>(null);
  const t = strings;
  const current = status.subscription;
  const state = status.state;
  const hasOngoingPlan = Boolean(
    current
    && !current.cancelled_at
    && (state === "active" || state === "grace" || state === "scheduled"),
  );
  const canRestart = state === "none" && cancelledSubscription !== null;
  const renewalSource = renewalMode === "restart" ? cancelledSubscription : current;
  const planDurationDays = renewalSource
    ? Math.max(0, Math.round(
      (new Date(renewalSource.expires_at).getTime() - new Date(renewalSource.starts_at).getTime())
      / 86_400_000,
    ))
    : 0;
  const reviewAllocation = allocation ?? (renewalSource ? {
    student_limit: status.limits?.students ?? 0,
    staff_limit: status.limits?.staff ?? 0,
    duration_days: planDurationDays,
    grace_days: renewalSource.grace_days,
    module_count: status.usage.courses ?? 0,
  } : null);

  return (
    <div className="form-card wide subscription-manage-card-v2">
      <div className="subscription-card-grid">
        <div className="sub-card-col-left">
          <div className="subscription-head-v2">
            <span className="table-item-subtitle" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
              {selectedInstitute.name}
            </span>
            <h2 className="subscription-plan-title">{current?.plan_name ?? t.noActivePlan}</h2>
            <span className={`badge ${STATE_BADGES[state]}`}>{stateLabel(state)}</span>
          </div>

          {current && state !== "none" && (
            <div className="subscription-dates-box">
              <p>
                <span>{t.starts}</span> <strong>{formatDate(current.starts_at)}</strong>
              </p>
              <p>
                <span>{t.expires}</span> <strong>{formatDate(current.expires_at)}</strong>
              </p>
              {current.days_remaining != null && (
                <p>
                  <span>
                    {state === "grace" ? t.graceDaysLeft : state === "scheduled" ? t.startsInDays : t.daysLeft}
                  </span>{" "}
                  <strong className="highlight-days">{current.days_remaining}</strong>
                </p>
              )}
            </div>
          )}

          <div className="subscription-actions-bar-v2">
            {/* Provisions come from the institute's own agreement - there is
                nothing to switch between here. */}
            <div style={{ width: "100%", marginBottom: 12 }}>
              <p className="hint" style={{ margin: 0 }}>
                {allocation ? allocationSummaryLine(allocation) : t.noAllocation}
              </p>
            </div>

            {canRestart ? (
              <Button
                fullWidth
                disabled={busy}
                leftIcon={<Icon name="restore" />}
                onClick={() => setRenewalMode("restart")}
              >
                {t.restartPlan}
              </Button>
            ) : state === "none" ? (
              <Button fullWidth disabled={busy || !allocation} onClick={onAssign}>
                {busy ? t.assigning : t.assignPlan}
              </Button>
            ) : hasOngoingPlan && current ? (
              <Button
                fullWidth
                disabled={busy}
                leftIcon={<Icon name="settings" />}
                onClick={() => setShowPlanDialog(true)}
              >
                {t.manageOngoingPlan}
              </Button>
            ) : (
              <Button fullWidth disabled={busy || !current} onClick={() => setRenewalMode("renew")}>
                {t.reviewRenewal}
              </Button>
            )}
          </div>
        </div>

        <div className="sub-card-col-right">
          {status.limits && <QuotaPieChart usage={status.usage} limits={status.limits} />}
          <ValidityGauge daysRemaining={current?.days_remaining ?? null} state={state} />
        </div>
      </div>

      {current && (
        <OngoingPlanDialog
          open={showPlanDialog}
          busy={busy}
          planName={current.plan_name ?? t.noActivePlan}
          expiresAt={current.expires_at}
          onClose={() => setShowPlanDialog(false)}
          onEdit={() => setShowEditDialog(true)}
          onRenew={() => setRenewalMode("renew")}
          onCancel={() => onCancel(current.id)}
        />
      )}

      {renewalSource && (
        <PlanRenewalDialog
          open={renewalMode !== null}
          mode={renewalMode ?? "renew"}
          busy={busy}
          planName={renewalSource.plan_name ?? t.noActivePlan}
          nextStartDate={renewalMode === "renew" ? renewalSource.expires_at : null}
          allocation={reviewAllocation}
          onClose={() => setRenewalMode(null)}
          onEdit={() => {
            setRenewalMode(null);
            setShowEditDialog(true);
          }}
          onConfirm={() => {
            setRenewalMode(null);
            if (renewalMode === "restart") {
              onRestart(renewalSource.plan_id);
            } else {
              onRenew(renewalSource.plan_id);
            }
          }}
        />
      )}

      {planEditValues && (
        <PlanEditDialog
          open={showEditDialog}
          busy={busy}
          instituteName={selectedInstitute.name}
          initialValues={planEditValues}
          agreementDocument={agreementDocument}
          paymentProof={paymentProof}
          onClose={() => setShowEditDialog(false)}
          onDownloadAttachment={onDownloadAttachment}
          onRemoveAttachment={onRemoveAttachment}
          onSave={onEditPlan}
        />
      )}
    </div>
  );
}
