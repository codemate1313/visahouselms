import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { confirmAction } from "@/components/confirmDialog";
import { PageHeader } from "@/components/ui";
import { usePageTitleStore } from "@/store/pageTitleStore";
import { useToastStore } from "@/store/toastStore";
import type { InstituteAllocation } from "@/pages/super-admin/InstituteForm/types";
import { subscriptionsStrings as strings } from "./Subscriptions.strings";
import type { InstituteRow, StatusResponse, SubscriptionInfo } from "./types";
import { InstituteSelector } from "./components/InstituteSelector";
import { SubscriptionManageCard } from "./components/SubscriptionManageCard";
import { SubscriptionHistoryTable } from "./components/SubscriptionHistoryTable";
import type { InstitutePlanEditValues } from "./components/PlanEditDialog";
import type { AgreementAttachment } from "@/pages/super-admin/InstituteForm/components/AgreementAttachments";

interface PlanDetails {
  duration_days: number;
  grace_days: number;
  module_count: number;
  staff_limit: number;
  student_limit: number;
}

export function Subscriptions() {
  const [institutes, setInstitutes] = useState<InstituteRow[]>([]);
  // Each institute's provisions come from its own agreement.
  const [allocation, setAllocation] = useState<InstituteAllocation | null>(null);
  const [planId, setPlanId] = useState<number | null>(null);
  const [planEditValues, setPlanEditValues] = useState<InstitutePlanEditValues | null>(null);
  const [agreementDocument, setAgreementDocument] = useState<AgreementAttachment | null>(null);
  const [paymentProof, setPaymentProof] = useState<AgreementAttachment | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [history, setHistory] = useState<SubscriptionInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const setItemCount = usePageTitleStore((state) => state.setItemCount);
  const showSuccess = useToastStore((state) => state.showSuccess);

  useEffect(() => {
    apiClient.get("/super-admin/institutes").then(({ data }) => {
      setInstitutes(data);
      if (data.length > 0) setSelected(data[0].id);
    });
  }, []);

  useEffect(() => {
    setItemCount(institutes.length);
    return () => setItemCount(null);
  }, [institutes.length, setItemCount]);

  const load = useCallback(async () => {
    if (selected === null) return;
    try {
      const [statusRes, historyRes, instituteRes] = await Promise.all([
        apiClient.get(`/super-admin/institutes/${selected}/subscription`),
        apiClient.get(`/super-admin/institutes/${selected}/subscriptions`),
        apiClient.get(`/super-admin/institutes/${selected}`),
      ]);
      const cancelledSubscription = (historyRes.data as SubscriptionInfo[])
        .find((row) => row.state === "cancelled");
      const resolvedPlanId = instituteRes.data.plan_id
        ?? statusRes.data.subscription?.plan_id
        ?? cancelledSubscription?.plan_id
        ?? null;
      let resolvedAllocation: InstituteAllocation | null = instituteRes.data.allocation ?? null;

      // Older institutes can have valid subscription history without the
      // newer institute-to-plan link. Recover the same plan from history so a
      // fully cancelled agreement can still be reviewed and restarted.
      if (!resolvedAllocation && resolvedPlanId) {
        const { data: plan } = await apiClient.get<PlanDetails>(`/super-admin/plans/${resolvedPlanId}`);
        resolvedAllocation = {
          student_limit: plan.student_limit,
          staff_limit: plan.staff_limit,
          duration_days: plan.duration_days,
          grace_days: plan.grace_days,
          module_count: plan.module_count,
        };
      }

      setStatus(statusRes.data);
      setHistory(historyRes.data);
      setAllocation(resolvedAllocation);
      setPlanId(resolvedPlanId);
      setPlanEditValues({
        agreement_reference: instituteRes.data.agreement_reference ?? "",
        agreement_notes: instituteRes.data.agreement_notes ?? "",
        agreed_amount: instituteRes.data.agreed_amount ?? "0",
        currency: instituteRes.data.agreement_currency ?? "INR",
        student_limit: instituteRes.data.student_limit ?? resolvedAllocation?.student_limit ?? 0,
        staff_limit: instituteRes.data.staff_limit ?? resolvedAllocation?.staff_limit ?? 0,
        access_duration_days: instituteRes.data.access_duration_days ?? resolvedAllocation?.duration_days ?? 365,
        grace_days: instituteRes.data.grace_days ?? resolvedAllocation?.grace_days ?? 0,
        module_ids: instituteRes.data.module_ids ?? [],
      });
      setAgreementDocument(instituteRes.data.agreement_document ?? null);
      setPaymentProof(instituteRes.data.payment_proof ?? null);
      setError(null);
    } catch {
      setError(strings.errors.load);
    }
  }, [selected]);

  useEffect(() => {
    setNotice(null);
    load();
  }, [load]);

  async function assign() {
    if (!selected || !planId) return;
    setError(null); setNotice(null); setBusy(true);
    try {
      await apiClient.post(`/super-admin/institutes/${selected}/subscription`, {
        plan_id: planId,
      });
      setNotice(strings.notices.assigned);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.assign));
    } finally {
      setBusy(false);
    }
  }

  async function renew(planIdToRenew: number) {
    if (!selected) return;
    setError(null); setNotice(null); setBusy(true);
    try {
      // The review dialog confirms exactly which plan is being renewed.
      await apiClient.post(`/super-admin/institutes/${selected}/subscription/renew`, {
        plan_id: planIdToRenew,
      });
      setNotice(strings.notices.renewed);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.renew));
    } finally {
      setBusy(false);
    }
  }

  async function restart(planIdToRestart: number) {
    if (!selected) return;
    setError(null); setNotice(null); setBusy(true);
    try {
      await apiClient.post(`/super-admin/institutes/${selected}/subscription`, {
        plan_id: planIdToRestart,
      });
      setNotice(strings.notices.restarted);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.restart));
    } finally {
      setBusy(false);
    }
  }

  async function cancel(subscriptionId: number) {
    const confirmed = await confirmAction(strings.cancelConfirm, {
      title: strings.cancelConfirmTitle,
      confirmText: strings.cancelConfirmButton,
      variant: "warning",
    });
    if (!confirmed) return;
    setError(null); setNotice(null);
    try {
      await apiClient.post(`/super-admin/subscriptions/${subscriptionId}/cancel`);
      setNotice(strings.notices.cancelled);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.cancel));
    }
  }

  async function editPlan(
    values: InstitutePlanEditValues,
    files: { agreementDocument: File | null; paymentProof: File | null },
  ): Promise<boolean> {
    if (!selected) return false;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await apiClient.patch(`/super-admin/institutes/${selected}`, values);
      const uploads: Promise<unknown>[] = [];
      if (files.agreementDocument) {
        const formData = new FormData();
        formData.append("file", files.agreementDocument);
        uploads.push(apiClient.post(
          `/super-admin/institutes/${selected}/documents/agreement`,
          formData,
        ));
      }
      if (files.paymentProof) {
        const formData = new FormData();
        formData.append("file", files.paymentProof);
        uploads.push(apiClient.post(
          `/super-admin/institutes/${selected}/documents/payment-proof`,
          formData,
        ));
      }
      await Promise.all(uploads);
      showSuccess(strings.notices.edited);
      setNotice(strings.notices.edited);
      await load();
      return true;
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.edit));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function downloadAttachment(attachment: AgreementAttachment) {
    try {
      const { data } = await apiClient.get<Blob>(attachment.download_url, {
        responseType: "blob",
      });
      const objectUrl = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = attachment.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to download attachment."));
    }
  }

  async function removeAttachment(kind: "agreement" | "payment-proof") {
    if (!selected) return;
    const confirmed = await confirmAction("Remove this attachment permanently?", {
      title: "Remove attachment",
      confirmText: "Remove",
      variant: "warning",
    });
    if (!confirmed) return;
    try {
      await apiClient.delete(`/super-admin/institutes/${selected}/documents/${kind}`);
      if (kind === "agreement") setAgreementDocument(null);
      else setPaymentProof(null);
      setNotice("Attachment removed.");
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to remove attachment."));
    }
  }

  const selectedInstitute = institutes.find((i) => i.id === selected);

  return (
    <div>
      <PageHeader title={strings.title} subtitle={strings.subtitle} />

      <InstituteSelector institutes={institutes} selected={selected} onSelect={setSelected} />

      {institutes.length === 0 && (
        <p className="hint" style={{ textAlign: "center", marginTop: 32, fontSize: "14.5px", color: "var(--text-muted)", width: "100%" }}>
          {strings.noInstitutes}
        </p>
      )}
      {error && <p className="error-text">{error}</p>}
      {notice && <p className="success-text">{notice}</p>}

      {status && selectedInstitute && (
        <SubscriptionManageCard
          status={status}
          selectedInstitute={selectedInstitute}
          allocation={allocation}
          agreementDocument={agreementDocument}
          busy={busy}
          cancelledSubscription={
            status.state === "none"
              ? history.find((row) => row.state === "cancelled") ?? null
              : null
          }
          planEditValues={planEditValues}
          onAssign={assign}
          onDownloadAttachment={(attachment) => void downloadAttachment(attachment)}
          onEditPlan={editPlan}
          onRemoveAttachment={(kind) => void removeAttachment(kind)}
          onRenew={renew}
          onRestart={restart}
          onCancel={cancel}
          paymentProof={paymentProof}
        />
      )}

      {history.length > 0 && <SubscriptionHistoryTable history={history} onCancel={cancel} />}
    </div>
  );
}
