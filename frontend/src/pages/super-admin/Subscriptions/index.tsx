import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { confirmAction } from "@/components/confirmDialog";
import { usePageTitleStore } from "@/store/pageTitleStore";
import type { InstituteAllocation } from "@/pages/super-admin/InstituteForm/types";
import { subscriptionsStrings as strings } from "./Subscriptions.strings";
import type { InstituteRow, StatusResponse, SubscriptionInfo } from "./types";
import { InstituteSelector } from "./components/InstituteSelector";
import { SubscriptionManageCard } from "./components/SubscriptionManageCard";
import { SubscriptionHistoryTable } from "./components/SubscriptionHistoryTable";

export function Subscriptions() {
  const [institutes, setInstitutes] = useState<InstituteRow[]>([]);
  // Each institute's provisions come from its own agreement.
  const [allocation, setAllocation] = useState<InstituteAllocation | null>(null);
  const [planId, setPlanId] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [history, setHistory] = useState<SubscriptionInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const setItemCount = usePageTitleStore((state) => state.setItemCount);

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
      setStatus(statusRes.data);
      setHistory(historyRes.data);
      setAllocation(instituteRes.data.allocation ?? null);
      setPlanId(instituteRes.data.plan_id ?? null);
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

  async function renew() {
    if (!selected) return;
    setError(null); setNotice(null); setBusy(true);
    try {
      // Renewing extends the institute's own plan - nothing else to pick.
      await apiClient.post(`/super-admin/institutes/${selected}/subscription/renew`, {
        plan_id: null,
      });
      setNotice(strings.notices.renewed);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.renew));
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

  const selectedInstitute = institutes.find((i) => i.id === selected);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{strings.title}</h1>
          <p className="page-subtitle">{strings.subtitle}</p>
        </div>
      </div>

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
          busy={busy}
          onAssign={assign}
          onRenew={renew}
          onCancel={cancel}
        />
      )}

      {history.length > 0 && <SubscriptionHistoryTable history={history} onCancel={cancel} />}
    </div>
  );
}
