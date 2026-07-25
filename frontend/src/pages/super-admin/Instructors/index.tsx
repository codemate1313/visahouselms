import { type FormEvent, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import type { InstructorAccount, InstructorPasswordReset } from "@/api/types";
import { confirmAction, confirmDelete } from "@/components/confirmDialog";
import { ConfirmModal } from "@/components/ConfirmModal";
import { usePageTitleStore } from "@/store/pageTitleStore";
import { instructorsStrings as strings } from "./Instructors.strings";
import type { PasswordNotice } from "./types";
import { extractTemporaryPassword } from "./helpers";
import { exportInstructorsExcel, exportInstructorsPDF } from "./exportHelpers";
import { PasswordNoticeBanner } from "./components/PasswordNoticeBanner";
import { InstructorsFilterBar } from "./components/InstructorsFilterBar";
import { InstructorsBulkActionsBar } from "./components/InstructorsBulkActionsBar";
import { InstructorsTable } from "./components/InstructorsTable";

export function Instructors() {
  const [instructors, setInstructors] = useState<InstructorAccount[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<PasswordNotice | null>(null);

  const [deletingInstructor, setDeletingInstructor] = useState<InstructorAccount | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const setItemCount = usePageTitleStore((state) => state.setItemCount);

  async function loadInstructors() {
    setLoading(true);
    try {
      const params: Record<string, string | boolean> = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== "all") params.active = statusFilter === "active";
      const { data } = await apiClient.get<InstructorAccount[]>("/super-admin/instructors", { params });
      setInstructors(data);
      setError(null);
    } catch {
      setError(strings.errors.load);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInstructors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    setItemCount(instructors.length);
    return () => setItemCount(null);
  }, [instructors.length, setItemCount]);

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    loadInstructors();
  }

  async function toggleActive(instructor: InstructorAccount) {
    const action = instructor.is_active ? "deactivate" : "reactivate";
    const confirmed = await confirmAction(
      strings.toggleConfirm(instructor.is_active ? "deactivate" : "activate", instructor.first_name || instructor.email),
      {
        title: instructor.is_active ? strings.deactivateTitle : strings.activateTitle,
        confirmText: instructor.is_active ? "Deactivate" : "Activate",
        variant: instructor.is_active ? "warning" : "primary",
      }
    );
    if (!confirmed) return;

    setError(null);
    setInstructors((current) =>
      current.map((item) => item.id === instructor.id ? { ...item, is_active: !instructor.is_active } : item)
    );
    try {
      await apiClient.post(`/super-admin/instructors/${instructor.id}/${action}`);
    } catch (err: unknown) {
      setInstructors((current) =>
        current.map((item) => item.id === instructor.id ? { ...item, is_active: instructor.is_active } : item)
      );
      setError(extractErrorMessage(err, strings.errors.toggle(action)));
    }
  }

  async function resetPassword(instructor: InstructorAccount) {
    const confirmed = await confirmAction(strings.resetPasswordConfirm(instructor.email), {
      title: strings.resetPasswordTitle,
      confirmText: "Reset Password",
      variant: "warning",
    });
    if (!confirmed) return;
    setError(null);
    try {
      const { data } = await apiClient.post<InstructorPasswordReset>(`/super-admin/instructors/${instructor.id}/reset-password`);
      const temporaryPassword = extractTemporaryPassword(data);
      if (!temporaryPassword) {
        setPasswordNotice(null);
        setError(strings.errors.missingPassword);
        return;
      }
      setPasswordNotice({ email: instructor.email, temporary_password: temporaryPassword });
      await loadInstructors();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.resetPassword));
    }
  }

  async function copyTemporaryPassword() {
    if (!passwordNotice) return;
    if (!passwordNotice.temporary_password) {
      setError(strings.errors.noPasswordToCopy);
      return;
    }
    await navigator.clipboard.writeText(passwordNotice.temporary_password);
  }

  async function handleConfirmDelete() {
    if (!deletingInstructor) return;
    setError(null);
    setDeleteLoading(true);
    try {
      await apiClient.delete(`/super-admin/instructors/${deletingInstructor.id}`);
      setDeletingInstructor(null);
      await loadInstructors();
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
      current.size === instructors.length ? new Set() : new Set(instructors.map((instructor) => instructor.id))
    );
  }

  async function bulkSetActive(active: boolean) {
    const targets = instructors.filter((instructor) => selectedIds.has(instructor.id) && instructor.is_active !== active);
    if (!targets.length) return;
    const confirmed = await confirmAction(strings.toggleManyConfirm(active ? "activate" : "deactivate", targets.length), {
      title: active ? strings.activateManyTitle : strings.deactivateManyTitle,
      confirmText: active ? "Activate" : "Deactivate",
      variant: active ? "primary" : "warning",
    });
    if (!confirmed) return;

    setBulkBusy(true);
    setError(null);
    const results = await Promise.allSettled(
      targets.map((instructor) => apiClient.post(`/super-admin/instructors/${instructor.id}/${active ? "reactivate" : "deactivate"}`))
    );
    const failed = results.filter((result) => result.status === "rejected").length;
    if (failed) setError(strings.errors.bulkToggle(active ? "activate" : "deactivate", failed, targets.length));
    setSelectedIds(new Set());
    setBulkBusy(false);
    await loadInstructors();
  }

  async function bulkDelete() {
    const targets = instructors.filter((instructor) => selectedIds.has(instructor.id));
    if (!targets.length) return;
    if (!await confirmDelete(strings.bulkDeleteConfirm(targets.length), strings.bulkDeleteConfirmTitle)) return;
    setBulkBusy(true);
    setError(null);
    const results = await Promise.allSettled(targets.map((instructor) => apiClient.delete(`/super-admin/instructors/${instructor.id}`)));
    const failed = results.filter((result) => result.status === "rejected").length;
    if (failed) setError(strings.errors.bulkDelete(failed, targets.length));
    setSelectedIds(new Set());
    setBulkBusy(false);
    await loadInstructors();
  }

  return (
    <div>
      {passwordNotice && (
        <PasswordNoticeBanner notice={passwordNotice} onCopy={copyTemporaryPassword} onDismiss={() => setPasswordNotice(null)} />
      )}

      <InstructorsFilterBar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onExportPdf={() => exportInstructorsPDF(instructors)}
        onExportExcel={() => exportInstructorsExcel(instructors)}
        resultCount={instructors.length}
        onSubmit={handleSearch}
      />

      {error && <p className="error-text">{error}</p>}

      {selectedIds.size > 0 && (
        <InstructorsBulkActionsBar
          selectedCount={selectedIds.size}
          busy={bulkBusy}
          hasInactiveSelected={instructors.some((instructor) => selectedIds.has(instructor.id) && !instructor.is_active)}
          onActivate={() => bulkSetActive(true)}
          onDeactivate={() => bulkSetActive(false)}
          onDelete={bulkDelete}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      {loading ? (
        <p>{strings.loading}</p>
      ) : (
        <InstructorsTable
          instructors={instructors}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onToggleActive={toggleActive}
          onResetPassword={resetPassword}
          onRequestDelete={setDeletingInstructor}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(deletingInstructor)}
        title={strings.deleteModal.title}
        message={deletingInstructor ? strings.deleteModal.message(deletingInstructor.email) : ""}
        confirmText={strings.deleteModal.confirmText}
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingInstructor(null)}
      />
    </div>
  );
}
