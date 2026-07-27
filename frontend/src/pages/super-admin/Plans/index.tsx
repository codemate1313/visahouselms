import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { confirmAction } from "@/components/confirmDialog";
import { ConfirmModal } from "@/components/ConfirmModal";
import { usePageTitleStore } from "@/store/pageTitleStore";
import { useToastStore } from "@/store/toastStore";
import { confirmExport } from "@/utils/confirmExport";
import { planCatalogues, plansStrings as strings, type PlanAudience } from "./Plans.strings";
import type { PlanRow, PlanVisibility } from "./types";
import { exportPlansExcel, exportPlansPDF } from "./exportHelpers";
import { PlanAudienceBar } from "./components/PlanAudienceBar";
import { PlansFilterBar } from "./components/PlansFilterBar";
import { PlansTable } from "./components/PlansTable";
import { PlanDetailsModal } from "./components/PlanDetailsModal";

export type { PlanRow } from "./types";

function parseAudience(value: string | null): PlanAudience {
  return value === "institutes" ? "institutes" : "direct_students";
}

export function Plans() {
  // One screen, two catalogues. The audience lives in the URL so a refresh, a
  // back button, or a link out of a plan form lands on the same catalogue.
  const [searchParams, setSearchParams] = useSearchParams();
  const audience = parseAudience(searchParams.get("audience"));
  const catalogue = planCatalogues[audience];
  const [plans, setPlans] = useState<PlanRow[]>([]);
  // Null until the flags arrive, so the switch never flashes a state the Super
  // Admin did not set.
  const [visibility, setVisibility] = useState<PlanVisibility | null>(null);
  const [visibilitySaving, setVisibilitySaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<PlanRow | null>(null);
  const [viewingPlan, setViewingPlan] = useState<PlanRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const setItemCount = usePageTitleStore((state) => state.setItemCount);
  // Failed actions are transient, so they surface as toasts rather than as a
  // banner the Super Admin has to dismiss by navigating away.
  const showError = useToastStore((state) => state.showError);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<PlanRow[]>("/super-admin/plans", { params: { audience } });
      setPlans(data);
      setLoadError(null);
    } catch {
      setLoadError(strings.errors.load);
    } finally {
      setLoading(false);
    }
  }, [audience]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<PlanVisibility>("/super-admin/plans/display-settings")
      .then(({ data }) => {
        if (!cancelled) setVisibility(data);
      })
      .catch(() => {
        // Non-fatal: the plan list is still usable, so this stays quiet and the
        // switches simply reflect nothing until the next load.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function changeAudience(next: PlanAudience) {
    if (next === audience) return;
    setSearchParams(next === "direct_students" ? {} : { audience: next }, { replace: true });
    setSearch("");
    setStatusFilter("");
  }

  async function changeVisibility(target: PlanAudience, visible: boolean) {
    const previous = visibility;
    if (!previous) return;
    setVisibility({ ...previous, [target]: visible });
    setVisibilitySaving(true);
    try {
      const { data } = await apiClient.put<PlanVisibility>("/super-admin/plans/display-settings", {
        [target]: visible,
      });
      setVisibility(data);
    } catch (err: unknown) {
      setVisibility(previous);
      showError(extractErrorMessage(err, strings.errors.visibility));
    } finally {
      setVisibilitySaving(false);
    }
  }

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

    setPlans((current) =>
      current.map((item) => item.id === plan.id ? { ...item, is_active: !plan.is_active } : item)
    );
    try {
      await apiClient.post(`/super-admin/plans/${plan.id}/${action}`);
    } catch (err: unknown) {
      setPlans((current) =>
        current.map((item) => item.id === plan.id ? { ...item, is_active: plan.is_active } : item)
      );
      showError(extractErrorMessage(err, strings.errors.toggle(action)));
    }
  }

  async function handleConfirmDelete() {
    if (!deletingPlan) return;
    setDeleteLoading(true);
    try {
      await apiClient.delete(`/super-admin/plans/${deletingPlan.id}`);
      setDeletingPlan(null);
      await load();
    } catch (err: unknown) {
      showError(extractErrorMessage(err, strings.errors.delete));
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleExportPdf() {
    if (!await confirmExport("pdf", catalogue.exportLabel)) return;
    exportPlansPDF(filteredPlans);
  }

  async function handleExportExcel() {
    if (!await confirmExport("excel", catalogue.exportLabel)) return;
    exportPlansExcel(filteredPlans);
  }

  return (
    <div>
      {loadError && <p className="error-text">{loadError}</p>}

      <PlanAudienceBar
        audience={audience}
        onAudienceChange={changeAudience}
        visibility={visibility}
        onVisibilityChange={changeVisibility}
        visibilitySaving={visibilitySaving}
      />

      <PlansFilterBar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onExportPdf={handleExportPdf}
        onExportExcel={handleExportExcel}
        resultCount={filteredPlans.length}
        newPlanPath={`${catalogue.basePath}/new`}
        newPlanLabel={catalogue.newPlan}
      />

      {loading ? (
        <p>{strings.loading}</p>
      ) : (
        <PlansTable plans={filteredPlans} basePath={catalogue.basePath} emptyMessage={catalogue.empty} onToggleActive={toggleActive} onView={setViewingPlan} onRequestDelete={setDeletingPlan} />
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
