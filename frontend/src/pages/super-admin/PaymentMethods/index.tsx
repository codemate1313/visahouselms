import { type FormEvent, useCallback, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { confirmAction } from "@/components/confirmDialog";
import { ConfirmModal } from "@/components/ConfirmModal";
import { PageHeader } from "@/components/ui";
import { RouteLoadingState } from "@/components/RouteLoadingState";
import { usePageTitleStore } from "@/store/pageTitleStore";
import { confirmExport } from "@/utils/confirmExport";
import { paymentMethodsStrings as strings } from "./PaymentMethods.strings";
import type { MethodRow } from "./types";
import { exportMethodsExcel, exportMethodsPDF } from "./exportHelpers";
import { AddMethodForm } from "./components/AddMethodForm";
import { MethodsFilterBar } from "./components/MethodsFilterBar";
import { MethodsTable } from "./components/MethodsTable";

export function PaymentMethods() {
  const [methods, setMethods] = useState<MethodRow[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [deletingMethod, setDeletingMethod] = useState<MethodRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const setItemCount = usePageTitleStore((state) => state.setItemCount);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<MethodRow[]>("/super-admin/payment-methods");
      setMethods(data);
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
  const filteredMethods = methods.filter((m) => {
    const matchesSearch = !query || m.name.toLowerCase().includes(query);
    const matchesStatus = !statusFilter || (statusFilter === "active" ? m.is_active : !m.is_active);
    return matchesSearch && matchesStatus;
  });

  useEffect(() => {
    setItemCount(filteredMethods.length);
    return () => setItemCount(null);
  }, [filteredMethods.length, setItemCount]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiClient.post("/super-admin/payment-methods", { name });
      setName("");
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.create));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(method: MethodRow) {
    const action = method.is_active ? "deactivate" : "reactivate";
    const confirmed = await confirmAction(
      strings.confirm.toggle(method.is_active ? "deactivate" : "activate", method.name),
      {
        title: method.is_active ? strings.confirm.deactivateTitle : strings.confirm.activateTitle,
        confirmText: method.is_active ? "Deactivate" : "Activate",
        variant: method.is_active ? "warning" : "primary",
      },
    );
    if (!confirmed) return;

    setError(null);
    setMethods((current) =>
      current.map((item) => item.id === method.id ? { ...item, is_active: !method.is_active } : item)
    );
    try {
      await apiClient.post(`/super-admin/payment-methods/${method.id}/${action}`);
    } catch (err: unknown) {
      setMethods((current) =>
        current.map((item) => item.id === method.id ? { ...item, is_active: method.is_active } : item)
      );
      setError(extractErrorMessage(err, strings.errors.toggle(action)));
    }
  }

  async function handleConfirmDelete() {
    if (!deletingMethod) return;
    setError(null);
    setDeleteLoading(true);
    try {
      await apiClient.delete(`/super-admin/payment-methods/${deletingMethod.id}`);
      setDeletingMethod(null);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.delete));
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleExportPdf() {
    if (!await confirmExport("pdf", "payment methods")) return;
    exportMethodsPDF(filteredMethods);
  }

  async function handleExportExcel() {
    if (!await confirmExport("excel", "payment methods")) return;
    exportMethodsExcel(filteredMethods);
  }

  return (
    <div>
      <PageHeader title={strings.title} subtitle={strings.subtitle} />

      <AddMethodForm name={name} onNameChange={setName} saving={saving} error={error} onSubmit={handleSubmit} />

      <MethodsFilterBar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onExportPdf={handleExportPdf}
        onExportExcel={handleExportExcel}
        resultCount={filteredMethods.length}
      />

      {loading ? (
        <RouteLoadingState />
      ) : (
        <MethodsTable methods={filteredMethods} onToggleActive={toggleActive} onRequestDelete={setDeletingMethod} />
      )}

      <ConfirmModal
        isOpen={Boolean(deletingMethod)}
        title={strings.deleteModal.title}
        message={deletingMethod ? strings.deleteModal.message(deletingMethod.name) : ""}
        confirmText={strings.deleteModal.confirmText}
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingMethod(null)}
      />
    </div>
  );
}
