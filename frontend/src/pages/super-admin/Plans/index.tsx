import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { confirmAction } from "@/components/confirmDialog";
import { ConfirmModal } from "@/components/ConfirmModal";
import { usePageTitleStore } from "@/store/pageTitleStore";
import { plansStrings as strings } from "./Plans.strings";
import type { PlanRow } from "./types";
import { exportPlansExcel, exportPlansPDF } from "./exportHelpers";
import { PlansFilterBar } from "./components/PlansFilterBar";
import { PlansTable } from "./components/PlansTable";
import { PlanDetailsModal } from "./components/PlanDetailsModal";

export type { PlanRow } from "./types";

export function Plans() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<PlanRow | null>(null);
  const [viewingPlan, setViewingPlan] = useState<PlanRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const setItemCount = usePageTitleStore((state) => state.setItemCount);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<PlanRow[]>("/super-admin/plans");
      setPlans(data);
      setError(null);
    } catch {
      setError(strings.errors.load);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const query = search.trim().toLowerCase();
  const filteredPlans = plans.filter((plan) => {
    const matchesSearch =
      !query ||
      plan.name.toLowerCase().includes(query) ||
      Boolean(plan.description?.toLowerCase().includes(query));

    const statusKey = !plan.is_active ? "inactive" : plan.is_published ? "active" : "draft";
    const matchesStatus = !statusFilter || statusKey === statusFilter;

    return matchesSearch && matchesStatus;
  });

  useEffect(() => {
    setItemCount(filteredPlans.length);
    return () => setItemCount(null);
  }, [filteredPlans.length, setItemCount]);

  async function toggleActive(plan: PlanRow) {
    const action = plan.is_active ? "deactivate" : "reactivate";
    const confirmed = await confirmAction(strings.confirm.toggle(plan.is_active ? "deactivate" : "activate", plan.name), {
      title: plan.is_active ? strings.confirm.deactivateTitle : strings.confirm.activateTitle,
      confirmText: plan.is_active ? "Deactivate" : "Activate",
      variant: plan.is_active ? "warning" : "primary",
    });
    if (!confirmed) return;

    setError(null);
    setPlans((current) =>
      current.map((item) => item.id === plan.id ? { ...item, is_active: !plan.is_active } : item)
    );
    try {
      await apiClient.post(`/super-admin/plans/${plan.id}/${action}`);
    } catch (err: unknown) {
      setPlans((current) =>
        current.map((item) => item.id === plan.id ? { ...item, is_active: plan.is_active } : item)
      );
      setError(extractErrorMessage(err, strings.errors.toggle(action)));
    }
  }

  async function handleConfirmDelete() {
    if (!deletingPlan) return;
    setError(null);
    setDeleteLoading(true);
    try {
      await apiClient.delete(`/super-admin/plans/${deletingPlan.id}`);
      setDeletingPlan(null);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.delete));
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div>
      {error && <p className="error-text">{error}</p>}

      <PlansFilterBar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onExportPdf={() => exportPlansPDF(filteredPlans)}
        onExportExcel={() => exportPlansExcel(filteredPlans)}
        resultCount={filteredPlans.length}
      />

      {loading ? (
        <p>{strings.loading}</p>
      ) : (
        <PlansTable plans={filteredPlans} onToggleActive={toggleActive} onView={setViewingPlan} onRequestDelete={setDeletingPlan} />
      )}

      {viewingPlan && <PlanDetailsModal plan={viewingPlan} onClose={() => setViewingPlan(null)} />}

      <ConfirmModal
        isOpen={Boolean(deletingPlan)}
        title={strings.deleteModal.title}
        message={deletingPlan ? strings.deleteModal.message(deletingPlan.name) : ""}
        confirmText={strings.deleteModal.confirmText}
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingPlan(null)}
      />
    </div>
  );
}
