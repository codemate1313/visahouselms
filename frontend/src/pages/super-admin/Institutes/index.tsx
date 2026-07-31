import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { confirmAction } from "@/components/confirmDialog";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Button } from "@/components/ui";
import { usePageTitleStore } from "@/store/pageTitleStore";
import { confirmExport } from "@/utils/confirmExport";
import { institutesStrings as strings } from "./Institutes.strings";
import type { InstituteRow, SortKey } from "./types";
import { exportInstitutesExcel, exportInstitutesPDF } from "./exportHelpers";
import { InstitutesFilterBar } from "./components/InstitutesFilterBar";
import { InstitutesTable } from "./components/InstitutesTable";
import { InstituteDetailDrawer } from "./components/InstituteDetailDrawer";

export function Institutes() {
  const [rows, setRows] = useState<InstituteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [subscriptionFilter, setSubscriptionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<"ascending" | "descending">("ascending");
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectedDrawerId, setSelectedDrawerId] = useState<number | null>(null);
  const setItemCount = usePageTitleStore((state) => state.setItemCount);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<InstituteRow[]>("/super-admin/institutes");
      setRows(data);
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
  const filteredRows = rows
    .filter((row) => {
      const matchesSearch =
        !query ||
        row.name.toLowerCase().includes(query) ||
        row.slug.toLowerCase().includes(query) ||
        Boolean(row.contact_email?.toLowerCase().includes(query));

      const matchesSub = !subscriptionFilter || row.subscription_state === subscriptionFilter;

      const activeStatus = row.onboarding_status === "draft" ? "draft" : row.is_active ? "active" : "suspended";
      const matchesStatus = !statusFilter || activeStatus === statusFilter;

      return matchesSearch && matchesSub && matchesStatus;
    })
    .sort((left, right) => {
      const comparison = left[sortKey].localeCompare(right[sortKey]);
      return sortDirection === "ascending" ? comparison : -comparison;
    });

  useEffect(() => {
    setItemCount(filteredRows.length);
    return () => setItemCount(null);
  }, [filteredRows.length, setItemCount]);

  useEffect(() => {
    setSelectedIds((current) => {
      const visibleIds = new Set(filteredRows.map((row) => row.id));
      const next = new Set(Array.from(current).filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [filteredRows]);

  function changeSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDirection((current) => current === "ascending" ? "descending" : "ascending");
      return;
    }
    setSortKey(nextKey);
    setSortDirection("ascending");
  }

  async function toggleActive(row: InstituteRow) {
    const action = row.is_active ? "suspend" : "reactivate";
    const confirmed = await confirmAction(strings.confirm.toggle(row.is_active ? "suspend" : "reactivate", row.name), {
      title: row.is_active ? strings.confirm.suspendTitle : strings.confirm.reactivateTitle,
      confirmText: row.is_active ? "Suspend" : "Reactivate",
      variant: row.is_active ? "warning" : "primary",
    });
    if (!confirmed) return;

    setError(null);
    setRows((current) =>
      current.map((item) => item.id === row.id ? { ...item, is_active: !row.is_active } : item)
    );
    try {
      await apiClient.post(`/super-admin/institutes/${row.id}/${action}`);
    } catch (err: unknown) {
      setRows((current) =>
        current.map((item) => item.id === row.id ? { ...item, is_active: row.is_active } : item)
      );
      setError(extractErrorMessage(err, strings.errors.toggle(action)));
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((current) =>
      current.size === filteredRows.length
        ? new Set()
        : new Set(filteredRows.map((row) => row.id))
    );
  }

  const selectedRows = filteredRows.filter((row) => selectedIds.has(row.id));

  async function bulkSetActive(active: boolean) {
    if (selectedRows.length === 0) return;
    const confirmed = await confirmAction(
      `${active ? "Reactivate" : "Suspend"} ${selectedRows.length} selected institute(s)?`,
      {
        title: active ? strings.confirm.reactivateTitle : strings.confirm.suspendTitle,
        confirmText: active ? "Reactivate" : "Suspend",
        variant: active ? "primary" : "warning",
      },
    );
    if (!confirmed) return;

    setBulkBusy(true);
    setError(null);
    const results = await Promise.allSettled(
      selectedRows.map((row) =>
        apiClient.post(`/super-admin/institutes/${row.id}/${active ? "reactivate" : "suspend"}`)
      )
    );
    if (results.some((result) => result.status === "rejected")) {
      setError(strings.errors.toggle(active ? "reactivate" : "suspend"));
    }
    setSelectedIds(new Set());
    setBulkBusy(false);
    await load();
  }

  async function bulkDelete() {
    if (selectedRows.length === 0) return;
    const confirmed = await confirmAction(
      `Permanently delete ${selectedRows.length} selected institute(s)? This cannot be undone.`,
      {
        title: strings.deleteModal.title,
        confirmText: strings.deleteModal.confirmText,
        variant: "danger",
      },
    );
    if (!confirmed) return;

    setBulkBusy(true);
    setError(null);
    const results = await Promise.allSettled(
      selectedRows.map((row) => apiClient.delete(`/super-admin/institutes/${row.id}`))
    );
    if (results.some((result) => result.status === "rejected")) {
      setError(strings.errors.delete);
    }
    setSelectedIds(new Set());
    setBulkBusy(false);
    await load();
  }

  const [deletingRow, setDeletingRow] = useState<InstituteRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function handleConfirmDelete() {
    if (!deletingRow) return;
    setError(null);
    setDeleteLoading(true);
    try {
      await apiClient.delete(`/super-admin/institutes/${deletingRow.id}`);
      setDeletingRow(null);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.delete));
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleExportPdf() {
    if (!await confirmExport("pdf", "institutes")) return;
    exportInstitutesPDF(filteredRows);
  }

  async function handleExportExcel() {
    if (!await confirmExport("excel", "institutes")) return;
    exportInstitutesExcel(filteredRows);
  }

  return (
    <div>
      {error && <p className="error-text">{error}</p>}

      <InstitutesFilterBar
        search={search}
        onSearchChange={setSearch}
        subscriptionFilter={subscriptionFilter}
        onSubscriptionFilterChange={setSubscriptionFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onExportPdf={handleExportPdf}
        onExportExcel={handleExportExcel}
        resultCount={filteredRows.length}
      />

      {selectedRows.length > 0 && (
        <div className="bulk-actions-bar">
          <span>
            <strong>{selectedRows.length}</strong> selected
          </span>
          <div className="bulk-actions-buttons">
            {selectedRows.some((row) => !row.is_active) ? (
              <Button variant="secondary" size="sm" disabled={bulkBusy} onClick={() => void bulkSetActive(true)}>
                Reactivate
              </Button>
            ) : (
              <Button variant="secondary" size="sm" disabled={bulkBusy} onClick={() => void bulkSetActive(false)}>
                Suspend
              </Button>
            )}
            <Button variant="danger" size="sm" disabled={bulkBusy} onClick={() => void bulkDelete()}>
              Delete
            </Button>
            <Button variant="secondary" size="sm" disabled={bulkBusy} onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p>{strings.loading}</p>
      ) : (
        <InstitutesTable
          rows={filteredRows}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onChangeSort={changeSort}
          onToggleActive={toggleActive}
          onRequestDelete={setDeletingRow}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onRowClick={setSelectedDrawerId}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(deletingRow)}
        title={strings.deleteModal.title}
        message={deletingRow ? strings.deleteModal.message(deletingRow.name) : ""}
        confirmText={strings.deleteModal.confirmText}
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingRow(null)}
      />

      <InstituteDetailDrawer
        instituteId={selectedDrawerId}
        onClose={() => setSelectedDrawerId(null)}
      />
    </div>
  );
}
