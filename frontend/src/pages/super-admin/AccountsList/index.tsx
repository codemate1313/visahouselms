import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import type { SuperAdminAccount } from "@/api/types";
import { confirmAction, confirmDelete } from "@/components/confirmDialog";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useAuthStore } from "@/store/authStore";
import { usePageTitleStore } from "@/store/pageTitleStore";
import { accountsListStrings as strings } from "./AccountsList.strings";
import { exportAccountsExcel, exportAccountsPDF } from "./exportHelpers";
import { AccountsFilterBar } from "./components/AccountsFilterBar";
import { AccountsBulkActionsBar } from "./components/AccountsBulkActionsBar";
import { AccountsTable } from "./components/AccountsTable";

export function AccountsList() {
  const currentUser = useAuthStore((state) => state.user);
  const setItemCount = usePageTitleStore((state) => state.setItemCount);
  const [accounts, setAccounts] = useState<SuperAdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deletingAccount, setDeletingAccount] = useState<SuperAdminAccount | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  async function loadAccounts() {
    setLoading(true);
    try {
      const { data } = await apiClient.get<SuperAdminAccount[]>("/super-admin/accounts");
      setAccounts(data);
      setError(null);
    } catch {
      setError(strings.errors.load);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  const query = search.trim().toLowerCase();
  const filteredAccounts = accounts.filter((account) => {
    const fullName = `${account.first_name} ${account.last_name}`.toLowerCase();
    const matchesSearch = !query || fullName.includes(query) || account.email.toLowerCase().includes(query);
    const matchesStatus = !statusFilter || (statusFilter === "active" ? account.is_active : !account.is_active);
    return matchesSearch && matchesStatus;
  });

  useEffect(() => {
    setItemCount(filteredAccounts.length);
    return () => setItemCount(null);
  }, [filteredAccounts.length, setItemCount]);

  async function handleToggleActive(account: SuperAdminAccount) {
    const action = account.is_active ? "deactivate" : "reactivate";
    const confirmed = await confirmAction(
      strings.confirm.toggleActive(account.is_active ? "deactivate" : "activate", `${account.first_name} ${account.last_name}`),
      {
        title: account.is_active ? strings.confirm.deactivateTitle : strings.confirm.activateTitle,
        confirmText: account.is_active ? "Deactivate" : "Activate",
        variant: account.is_active ? "warning" : "primary",
      }
    );
    if (!confirmed) return;

    setError(null);
    setAccounts((current) =>
      current.map((item) => item.id === account.id ? { ...item, is_active: !account.is_active } : item)
    );
    try {
      await apiClient.post(`/super-admin/accounts/${account.id}/${action}`);
    } catch (err: unknown) {
      setAccounts((current) =>
        current.map((item) => item.id === account.id ? { ...item, is_active: account.is_active } : item)
      );
      setError(extractErrorMessage(err, strings.errors.toggleActive(action)));
    }
  }

  async function handleForceReset(account: SuperAdminAccount) {
    setError(null);
    setAccounts((current) =>
      current.map((item) =>
        item.id === account.id ? { ...item, force_password_reset: !account.force_password_reset } : item
      )
    );
    try {
      await apiClient.post(`/super-admin/accounts/${account.id}/force-password-reset`, {
        enabled: !account.force_password_reset,
      });
    } catch (err: unknown) {
      setAccounts((current) =>
        current.map((item) =>
          item.id === account.id ? { ...item, force_password_reset: account.force_password_reset } : item
        )
      );
      setError(extractErrorMessage(err, strings.errors.forceReset));
    }
  }

  async function handleConfirmDelete() {
    if (!deletingAccount) return;
    setError(null);
    setDeleteLoading(true);
    try {
      await apiClient.delete(`/super-admin/accounts/${deletingAccount.id}`);
      setDeletingAccount(null);
      await loadAccounts();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.delete));
    } finally {
      setDeleteLoading(false);
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((current) =>
      current.size === filteredAccounts.length ? new Set() : new Set(filteredAccounts.map((account) => account.id))
    );
  }

  async function bulkSetActive(active: boolean) {
    const targets = filteredAccounts.filter((account) => selectedIds.has(account.id) && account.is_active !== active);
    if (!targets.length) return;
    const confirmed = await confirmAction(strings.confirm.toggleMany(active ? "activate" : "deactivate", targets.length), {
      title: active ? strings.confirm.activateManyTitle : strings.confirm.deactivateManyTitle,
      confirmText: active ? "Activate" : "Deactivate",
      variant: active ? "primary" : "warning",
    });
    if (!confirmed) return;
    setBulkBusy(true);
    setError(null);
    const results = await Promise.allSettled(
      targets.map((account) => apiClient.post(`/super-admin/accounts/${account.id}/${active ? "reactivate" : "deactivate"}`))
    );
    const failed = results.filter((result) => result.status === "rejected").length;
    if (failed) setError(strings.errors.bulkToggle(active ? "activate" : "deactivate", failed, targets.length));
    setSelectedIds(new Set());
    setBulkBusy(false);
    await loadAccounts();
  }

  async function bulkDelete() {
    const targets = filteredAccounts.filter((account) => selectedIds.has(account.id));
    if (!targets.length) return;
    if (!await confirmDelete(strings.bulkDeleteConfirm(targets.length), strings.bulkDeleteConfirmTitle)) return;
    setBulkBusy(true);
    setError(null);
    const results = await Promise.allSettled(targets.map((account) => apiClient.delete(`/super-admin/accounts/${account.id}`)));
    const failed = results.filter((result) => result.status === "rejected").length;
    if (failed) setError(strings.errors.bulkDelete(failed, targets.length));
    setSelectedIds(new Set());
    setBulkBusy(false);
    await loadAccounts();
  }

  return (
    <div>
      <AccountsFilterBar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onExportPdf={() => exportAccountsPDF(filteredAccounts)}
        onExportExcel={() => exportAccountsExcel(filteredAccounts)}
        resultCount={filteredAccounts.length}
      />

      {error && <p className="error-text">{error}</p>}

      {selectedIds.size > 0 && (
        <AccountsBulkActionsBar
          selectedCount={selectedIds.size}
          busy={bulkBusy}
          hasInactiveSelected={filteredAccounts.some((account) => selectedIds.has(account.id) && !account.is_active)}
          onActivate={() => bulkSetActive(true)}
          onDeactivate={() => bulkSetActive(false)}
          onDelete={bulkDelete}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      {loading ? (
        <p>{strings.loading}</p>
      ) : (
        <AccountsTable
          accounts={filteredAccounts}
          currentUserId={currentUser?.id}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onToggleActive={handleToggleActive}
          onForceReset={handleForceReset}
          onRequestDelete={setDeletingAccount}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(deletingAccount)}
        title={strings.deleteModal.title}
        message={deletingAccount ? strings.deleteModal.message(deletingAccount.email) : ""}
        confirmText={strings.deleteModal.confirmText}
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingAccount(null)}
      />
    </div>
  );
}
