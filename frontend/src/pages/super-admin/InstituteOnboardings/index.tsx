import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { ConfirmModal } from "@/components/ConfirmModal";
import { confirmExport } from "@/utils/confirmExport";
import { instituteOnboardingsStrings as strings } from "./InstituteOnboardings.strings";
import type { OnboardingRow } from "./types";
import { exportOnboardingsExcel, exportOnboardingsPDF } from "./exportHelpers";
import { OnboardingsFilterBar } from "./components/OnboardingsFilterBar";
import { OnboardingsTable } from "./components/OnboardingsTable";

export function InstituteOnboardings() {
  const [rows, setRows] = useState<OnboardingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deletingRow, setDeletingRow] = useState<OnboardingRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<OnboardingRow[]>("/super-admin/onboarding");
      setRows(data);
      setError(null);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.load));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const query = search.trim().toLowerCase();
  const filteredRows = rows.filter((row) => {
    const matchesSearch =
      !query ||
      row.name.toLowerCase().includes(query) ||
      Boolean(row.contact_email?.toLowerCase().includes(query));

    const matchesStatus = !statusFilter || row.onboarding_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  async function handleExportPdf() {
    if (!await confirmExport("pdf", "institute onboardings")) return;
    exportOnboardingsPDF(filteredRows);
  }

  async function handleExportExcel() {
    if (!await confirmExport("excel", "institute onboardings")) return;
    exportOnboardingsExcel(filteredRows);
  }

  async function handleConfirmDelete() {
    if (!deletingRow) return;
    const rowToDelete = deletingRow;
    setDeleteLoading(true);
    setError(null);
    try {
      await apiClient.delete(`/super-admin/onboarding/${rowToDelete.id}`);
      setRows((current) => current.filter((row) => row.id !== rowToDelete.id));
      setDeletingRow(null);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.delete));
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div>
      {error && <p className="error-text">{error}</p>}

      <OnboardingsFilterBar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onExportPdf={handleExportPdf}
        onExportExcel={handleExportExcel}
      />

      {loading ? <p>{strings.loading}</p> : <OnboardingsTable rows={filteredRows} onRequestDelete={setDeletingRow} />}

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
