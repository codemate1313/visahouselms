import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { confirmAction, confirmDelete } from "@/components/confirmDialog";
import { useAuthStore } from "@/store/authStore";
import { instituteMembersStrings as strings } from "./InstituteMembers.strings";
import type { ImportResult, InstituteMember, MemberCapacity } from "./types";
import { MembersHeader } from "./components/MembersHeader";
import { MembersFilterBar } from "./components/MembersFilterBar";
import { MembersBulkActionsBar } from "./components/MembersBulkActionsBar";
import { MembersFeatureLocked } from "./components/MembersFeatureLocked";
import { MembersTable } from "./components/MembersTable";
import { CredentialModal } from "./components/CredentialModal";
import { ImportResultModal } from "./components/ImportResultModal";

export type { InstituteMember, MemberCapacity } from "./types";

interface Props {
  role?: InstituteMember["role"];
  instituteId?: number;
}

export function InstituteMembers({ role, instituteId }: Props) {
  const isStudent = role === "STUDENT";
  const isAllAccounts = role === undefined;
  const permissions = useAuthStore((state) => state.user?.institute_permissions);
  const isSuperAdmin = instituteId !== undefined;
  const label = isAllAccounts ? "Accounts" : isStudent ? "Students" : "Instructors";
  const apiBase = isSuperAdmin ? `/super-admin/institutes/${instituteId}` : "/institute";
  const basePath = isSuperAdmin
    ? `/super-admin/institutes/${instituteId}/accounts`
    : isStudent ? "/institute-portal/students" : "/institute-portal/staff";
  const [capacity, setCapacity] = useState<MemberCapacity | null>(null);
  const canAddStudents = Boolean(capacity?.can_add.students);
  const canAddStaff = Boolean(capacity?.can_add.staff);
  const canProvision = ((isSuperAdmin && (isStudent || isAllAccounts)) || (!isSuperAdmin && isStudent && Boolean(permissions?.manage_students))) && canAddStudents;
  const canManage = isSuperAdmin || (isStudent ? permissions?.manage_students : permissions?.manage_staff);
  const canViewActivity = isSuperAdmin || permissions?.view_student_activity;
  const staffFeatureLocked = !isSuperAdmin && !isStudent && capacity?.limits.staff === 0;
  const [members, setMembers] = useState<InstituteMember[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [activityFilter, setActivityFilter] = useState("");
  const [sessionFilter, setSessionFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [credential, setCredential] = useState<{ name: string; password: string } | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const selectableMembers = members.filter((member) => !member.deleted_at);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [membersResponse, capacityResponse] = await Promise.all([
        apiClient.get<InstituteMember[]>(`${apiBase}/members`, {
          params: {
            role: (role ?? roleFilter) || undefined,
            search: search || undefined,
            status: statusFilter || undefined,
            has_attempts: activityFilter === "attempts" ? true : activityFilter === "no_attempts" ? false : undefined,
            has_devices: sessionFilter === "known_devices" ? true : sessionFilter === "no_devices" ? false : undefined,
            has_active_sessions: sessionFilter === "active_session" ? true : undefined,
          },
        }),
        apiClient.get<MemberCapacity>(`${apiBase}/member-capacity`),
      ]);
      setMembers(membersResponse.data);
      setCapacity(capacityResponse.data);
      setError(null);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.load(label)));
    } finally {
      setLoading(false);
    }
  }, [activityFilter, apiBase, label, role, roleFilter, search, sessionFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function toggle(member: InstituteMember) {
    const isDeactivating = member.is_active;
    const confirmed = await confirmAction(
      strings.confirm.toggleMember(isDeactivating ? "deactivate" : "activate", `${member.first_name} ${member.last_name}`, member.email),
      {
        title: isDeactivating ? strings.confirm.deactivateMemberTitle : strings.confirm.activateMemberTitle,
        confirmText: isDeactivating ? "Deactivate" : "Activate",
        variant: isDeactivating ? "warning" : "primary",
      }
    );
    if (!confirmed) return;
    try {
      await apiClient.post(`${apiBase}/members/${member.id}/${isDeactivating ? "deactivate" : "reactivate"}`);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.updateStatus));
    }
  }

  async function resetPassword(member: InstituteMember) {
    const confirmed = await confirmAction(strings.confirm.resetPassword(member.email), {
      title: strings.confirm.resetPasswordTitle,
      confirmText: strings.confirm.resetPasswordConfirm,
      variant: "warning",
    });
    if (!confirmed) return;
    try {
      const { data } = await apiClient.post(`${apiBase}/members/${member.id}/reset-password`);
      setCredential({ name: `${member.first_name} ${member.last_name}`, password: data.temporary_password });
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.resetPassword));
    }
  }

  async function remove(member: InstituteMember) {
    if (!await confirmDelete(strings.confirm.deleteOne(member.email), strings.confirm.deleteOneTitle)) return;
    try {
      await apiClient.delete(`${apiBase}/members/${member.id}`);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.delete));
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
      current.size === selectableMembers.length ? new Set() : new Set(selectableMembers.map((member) => member.id))
    );
  }

  async function bulkSetActive(active: boolean) {
    const targets = selectableMembers.filter((member) => selectedIds.has(member.id) && member.is_active !== active);
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
      targets.map((member) => apiClient.post(`${apiBase}/members/${member.id}/${active ? "reactivate" : "deactivate"}`))
    );
    const failed = results.filter((result) => result.status === "rejected").length;
    if (failed) setError(strings.errors.bulkToggle(active ? "activate" : "deactivate", failed, targets.length));
    setSelectedIds(new Set());
    setBulkBusy(false);
    await load();
  }

  async function bulkRemove() {
    const targets = selectableMembers.filter((member) => selectedIds.has(member.id));
    if (!targets.length) return;
    if (!await confirmDelete(strings.confirm.deleteMany(targets.length), strings.confirm.deleteManyTitle)) return;
    setBulkBusy(true);
    setError(null);
    const results = await Promise.allSettled(targets.map((member) => apiClient.delete(`${apiBase}/members/${member.id}`)));
    const failed = results.filter((result) => result.status === "rejected").length;
    if (failed) setError(strings.errors.bulkDelete(failed, targets.length));
    setSelectedIds(new Set());
    setBulkBusy(false);
    await load();
  }

  async function importFile(file: File) {
    const form = new FormData();
    form.append("file", file);
    try {
      const { data } = await apiClient.post<ImportResult>(`${apiBase}/students/import`, form);
      setImportResult(data);
      setError(null);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.import));
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function downloadTemplate() {
    const csv = "first_name,last_name,email,phone_number,address\nAarav,Sharma,aarav@example.com,+919000000000,Delhi\n";
    downloadCsv(csv, "student-import-template.csv");
  }

  function downloadCredentials() {
    if (!importResult) return;
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = importResult.created.map((item) =>
      [item.first_name, item.last_name, item.email, item.temporary_password].map(escape).join(","),
    );
    downloadCsv(["first_name,last_name,email,temporary_password", ...rows].join("\n"), "student-credentials.csv");
  }

  function downloadCsv(content: string, filename: string) {
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <MembersHeader
        label={label}
        canProvision={canProvision}
        isSuperAdmin={isSuperAdmin}
        isStudent={isStudent}
        canManage={canManage}
        canAddStudents={canAddStudents}
        canAddStaff={canAddStaff}
        basePath={basePath}
        onDownloadTemplate={downloadTemplate}
        onImportClick={() => fileInput.current?.click()}
        onImportFile={importFile}
        fileInputRef={fileInput}
      />

      {!staffFeatureLocked && (
        <MembersFilterBar
          label={label}
          isAllAccounts={isAllAccounts}
          search={search}
          onSearchChange={setSearch}
          roleFilter={roleFilter}
          onRoleFilterChange={setRoleFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          activityFilter={activityFilter}
          onActivityFilterChange={setActivityFilter}
          sessionFilter={sessionFilter}
          onSessionFilterChange={setSessionFilter}
        />
      )}
      {error && <p className="error-text">{error}</p>}

      {canManage && selectedIds.size > 0 && (
        <MembersBulkActionsBar
          selectedCount={selectedIds.size}
          busy={bulkBusy}
          hasInactiveSelected={selectableMembers.some((member) => selectedIds.has(member.id) && !member.is_active)}
          onActivate={() => bulkSetActive(true)}
          onDeactivate={() => bulkSetActive(false)}
          onDelete={bulkRemove}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      {!loading && staffFeatureLocked && <MembersFeatureLocked canViewBilling={permissions?.view_billing} />}

      {!staffFeatureLocked && (
        <>
          {loading ? (
            <p>{strings.loading}</p>
          ) : (
            <MembersTable
              label={label}
              members={members}
              selectableMembers={selectableMembers}
              selectedIds={selectedIds}
              canManage={canManage}
              canViewActivity={canViewActivity}
              isAllAccounts={isAllAccounts}
              basePath={basePath}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              onResetPassword={resetPassword}
              onToggleActive={toggle}
              onRemove={remove}
            />
          )}
        </>
      )}

      {credential && <CredentialModal credential={credential} onClose={() => setCredential(null)} />}

      {importResult && (
        <ImportResultModal
          result={importResult}
          onClose={() => setImportResult(null)}
          onDownloadCredentials={downloadCredentials}
        />
      )}
    </div>
  );
}

export function SuperAdminInstituteStudents() {
  const { id } = useParams();
  return <InstituteMembers role="STUDENT" instituteId={Number(id)} />;
}

export function SuperAdminInstituteAccounts() {
  const { id } = useParams();
  return <InstituteMembers instituteId={Number(id)} />;
}
