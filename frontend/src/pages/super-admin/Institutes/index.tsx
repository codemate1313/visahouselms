import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { ConfirmModal } from "@/components/ConfirmModal";
import { usePageTitleStore } from "@/store/pageTitleStore";
import { institutesStrings as strings } from "./Institutes.strings";
import type { InstituteRow, SortKey } from "./types";
import { exportInstitutesExcel, exportInstitutesPDF } from "./exportHelpers";
import { InstitutesFilterBar } from "./components/InstitutesFilterBar";
import { InstitutesTable } from "./components/InstitutesTable";

export function Institutes() {
  const [rows, setRows] = useState<InstituteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [subscriptionFilter, setSubscriptionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<"ascending" | "descending">("ascending");
  const [error, setError] = useState<string | null>(null);
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

  function changeSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDirection((current) => current === "ascending" ? "descending" : "ascending");
      return;
    }
    setSortKey(nextKey);
    setSortDirection("ascending");
  }

  async function toggleActive(row: InstituteRow) {
    setError(null);
    const action = row.is_active ? "suspend" : "reactivate";
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
        onExportPdf={() => exportInstitutesPDF(filteredRows)}
        onExportExcel={() => exportInstitutesExcel(filteredRows)}
        resultCount={filteredRows.length}
      />

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
    </div>
  );
}
