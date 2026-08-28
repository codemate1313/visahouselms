import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { confirmAction } from "@/components/confirmDialog";
import { ConfirmModal } from "@/components/ConfirmModal";
import { SegmentedControl } from "@/components/ui";
import { usePageTitleStore } from "@/store/pageTitleStore";
import { useToastStore } from "@/store/toastStore";
import { confirmExport } from "@/utils/confirmExport";
import { planAudienceTabs, planCatalogues, plansStrings as strings, type PlanAudience } from "./Plans.strings";
import type { PlanRow, PlanVisibility } from "./types";
import { exportPlansExcel, exportPlansPDF } from "./exportHelpers";
import { PlansFilterBar } from "./components/PlansFilterBar";
import { PlansTable } from "./components/PlansTable";
import { PlanDetailsModal } from "./components/PlanDetailsModal";
import { Icon } from "@/components/icons";

export type { PlanRow } from "./types";

const PAGE_SIZE = 25;

export function Plans() {
  // Two catalogues share this screen. Bespoke institute agreements are marked
  // internal and are filtered out server-side, so the institutes tab only ever
  // shows the standard tiers - editing one here cannot touch a negotiated deal.
  const [audience, setAudience] = useState<PlanAudience>("direct_students");
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
  const [page, setPage] = useState(1);
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

  async function changeVisibility(visible: boolean) {
    const previous = visibility;
    if (!previous) return;
    setVisibility({ ...previous, [audience]: visible });
    setVisibilitySaving(true);
    try {
      const { data } = await apiClient.put<PlanVisibility>("/super-admin/plans/display-settings", {
        [audience]: visible,
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

  // A new audience, search, or status filter describes a different result
  // set, so pagination restarts from page 1.
  useEffect(() => {
    setPage(1);
  }, [audience, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPlans.length / PAGE_SIZE));
  const pagedPlans = filteredPlans.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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

  async function handleTogglePopular(plan: PlanRow) {
    try {
      const { data: updated } = await apiClient.post<PlanRow>(`/super-admin/plans/${plan.id}/toggle-popular`);
      setPlans((prev) =>
        prev.map((p) => {
          if (p.id === updated.id) {
            return { ...p, is_popular: updated.is_popular };
          }
          // If updated became popular, unmark all other plans in the same audience
          if (updated.is_popular && p.audience === updated.audience) {
            return { ...p, is_popular: false };
          }
          return p;
        })
      );
      useToastStore.getState().showSuccess(
        updated.is_popular ? strings.table.popularMarked : strings.table.popularUnmarked
      );
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Failed to update popular status."));
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

  const catalogue = planCatalogues[audience];

  function switchAudience(next: PlanAudience) {
    if (next === audience) return;
    setAudience(next);
    // Filters describe the list that is going away, so they reset with it.
    setSearch("");
    setStatusFilter("");
  }

  return (
    <div>
      {loadError && <p className="error-text">{loadError}</p>}

      <div className="plan-audience-tabs">
        <SegmentedControl<PlanAudience>
          ariaLabel="Plan audience"
          options={planAudienceTabs.map((tab) => ({ value: tab.value, label: tab.label }))}
          value={audience}
          onChange={switchAudience}
        />
      </div>

      {audience === "institutes" && <p className="hint plan-audience-note">{strings.editingNote}</p>}

      <PlansFilterBar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onExportPdf={handleExportPdf}
        onExportExcel={handleExportExcel}
        resultCount={filteredPlans.length}
        newPlanPath={`${catalogue.basePath}/new?audience=${audience}`}
        newPlanLabel={catalogue.newPlan}
        visible={Boolean(visibility?.[audience])}
        visibilityLoaded={visibility !== null}
        visibilitySaving={visibilitySaving}
        onVisibilityChange={changeVisibility}
        visibilityHint={visibility !== null ? (visibility[audience] ? catalogue.visibilityHint : catalogue.hiddenHint) : undefined}
      />

      {loading ? (
        <p>{strings.loading}</p>
      ) : (
        <>
          <PlansTable plans={pagedPlans} basePath={catalogue.basePath} emptyMessage={catalogue.empty} onToggleActive={toggleActive} onTogglePopular={handleTogglePopular} onView={setViewingPlan} onRequestDelete={setDeletingPlan} />
          {totalPages > 1 && (
            <div className="pagination">
              <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <Icon name="arrowLeft" /> Previous
              </button>
              <span>
                Page {page} of {totalPages} ({filteredPlans.length} total)
              </span>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                Next <Icon name="arrowRight" />
              </button>
            </div>
          )}
        </>
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
