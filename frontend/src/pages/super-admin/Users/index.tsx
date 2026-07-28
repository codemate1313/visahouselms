import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { confirmAction } from "@/components/confirmDialog";
import { ConfirmModal } from "@/components/ConfirmModal";
import { SearchableSelect, SearchInput } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { usePageTitleStore } from "@/store/pageTitleStore";
import {
  DIRECTORY_ROLES,
  type DirectoryRole,
  type DirectoryUser,
  type DirectoryUserPage,
} from "@/api/types";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
import { confirmExport } from "@/utils/confirmExport";
import { usersStrings as strings } from "./Users.strings";
import { UsersTable } from "./components/UsersTable";
import { ROLE_ACTIONS, canDeleteMember, memberActionBase, passwordResetPath } from "./userActions";
import { exportUsersExcel, exportUsersPDF } from "./exportHelpers";

const PAGE_SIZE = 25;
const DEFAULT_ROLE: DirectoryRole = "SUPER_ADMIN";

/** URL slug <-> role, so each sidebar child owns a real, linkable address. */
const ROLE_BY_SLUG: Record<string, DirectoryRole> = {
  "super-admins": "SUPER_ADMIN",
  "sa-instructors": "SA_INSTRUCTOR",
  "institute-admins": "INSTITUTE_ADMIN",
  "institute-staff": "INST_INSTRUCTOR",
  students: "STUDENT",
};

export const SLUG_BY_ROLE = Object.fromEntries(
  Object.entries(ROLE_BY_SLUG).map(([slug, role]) => [role, slug])
) as Record<DirectoryRole, string>;

/** Roles that have a dedicated create screen; the rest are created per institute. */
const NEW_ROUTE: Partial<Record<DirectoryRole, string>> = {
  SUPER_ADMIN: "/super-admin/accounts/new",
  SA_INSTRUCTOR: "/super-admin/instructors/new",
};

/** Roles created inside an institute: the directory picks one, then hands off
 *  to that institute's own create form. */
const TENANT_NEW_PATH: Partial<Record<DirectoryRole, (instituteId: string) => string>> = {
  STUDENT: (id) => `/super-admin/institutes/${id}/accounts/students/new`,
  INST_INSTRUCTOR: (id) => `/super-admin/institutes/${id}/accounts/staff/new`,
};

export function Users() {
  const { role: roleSlug } = useParams();
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const setItemCount = usePageTitleStore((state) => state.setItemCount);

  const activeRole: DirectoryRole = (roleSlug && ROLE_BY_SLUG[roleSlug]) || DEFAULT_ROLE;

  const [data, setData] = useState<DirectoryUserPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [deletingUser, setDeletingUser] = useState<DirectoryUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<
    { email: string; temporary_password: string } | null
  >(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [studentFilter, setStudentFilter] = useState<"all" | "direct" | "institutes">("all");
  const [selectedInstituteId, setSelectedInstituteId] = useState<string>("");
  const [institutes, setInstitutes] = useState<{ id: number; name: string }[]>([]);
  // Students and institute instructors live inside an institute, so creating
  // one from the directory asks which institute first.
  const [showInstituteModal, setShowInstituteModal] = useState(false);
  const [newStudentInstituteId, setNewStudentInstituteId] = useState<string>("");

  useEffect(() => {
    async function fetchInstitutes() {
      try {
        const { data: insts } = await apiClient.get<any[]>("/super-admin/institutes");
        setInstitutes(insts || []);
      } catch (err) {
        console.error("Failed to load institutes", err);
      }
    }
    fetchInstitutes();
  }, []);

  // Filters and selection describe the visible tab, so switching tabs starts
  // clean - carrying a selection across tabs would target the wrong endpoints.
  useEffect(() => {
    setSearch("");
    setStatusFilter("");
    setStudentFilter("all");
    setSelectedInstituteId("");
    setPage(1);
    setSelectedIds(new Set());
    setPasswordNotice(null);
  }, [activeRole]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {
        role: activeRole,
        q: search.trim() || undefined,
        status: statusFilter || undefined,
        page,
        page_size: PAGE_SIZE,
      };

      if (activeRole === "STUDENT") {
        if (studentFilter === "direct") {
          params.direct = true;
        } else if (studentFilter === "institutes") {
          params.direct = false;
          if (selectedInstituteId) {
            params.institute_id = Number(selectedInstituteId);
          }
        }
      } else if (activeRole === "INSTITUTE_ADMIN" || activeRole === "INST_INSTRUCTOR") {
        if (selectedInstituteId) {
          params.institute_id = Number(selectedInstituteId);
        }
      }

      const { data: page_ } = await apiClient.get<DirectoryUserPage>("/super-admin/users", {
        params,
      });
      setData(page_);
      setError(null);
    } catch {
      setError(strings.errors.load);
    } finally {
      setLoading(false);
    }
  }, [activeRole, search, statusFilter, studentFilter, selectedInstituteId, page]);

  // Debounced so typing in the search box does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(loadUsers, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadUsers, search]);

  useEffect(() => {
    // Show the grand total across all roles (not just the current tab/filter).
    const grandTotal = data?.role_counts
      ? Object.values(data.role_counts).reduce((sum, n) => sum + n, 0)
      : null;
    setItemCount(grandTotal);
    return () => setItemCount(null);
  }, [data?.role_counts, setItemCount]);

  /** Optimistic patch of one row, so toggles feel instant without a refetch. */
  function patchUser(id: number, changes: Partial<DirectoryUser>) {
    setData((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) =>
              item.id === id ? { ...item, ...changes } : item
            ),
          }
        : current
    );
  }

  async function handleToggleActive(user: DirectoryUser) {
    const action = user.is_active ? "deactivate" : "reactivate";
    const confirmed = await confirmAction(
      strings.confirm.toggle(user.is_active, `${user.first_name} ${user.last_name}`),
      {
        title: strings.confirm.toggleTitle(user.is_active),
        confirmText: user.is_active ? "Deactivate" : "Activate",
        variant: user.is_active ? "warning" : "primary",
      }
    );
    if (!confirmed) return;

    // Platform-wide roles have their own endpoints; institute members go
    // through their institute, and direct students through the directory.
    const base = ROLE_ACTIONS[user.role_name]?.base ?? memberActionBase(user);
    if (!base) return;

    setError(null);
    patchUser(user.id, { is_active: !user.is_active });
    try {
      await apiClient.post(`${base}/${user.id}/${action}`);
    } catch (err: unknown) {
      patchUser(user.id, { is_active: user.is_active });
      setError(extractErrorMessage(err, strings.errors.toggleActive(action)));
    }
  }

  async function handleForceReset(user: DirectoryUser) {
    const base = ROLE_ACTIONS[user.role_name]?.base;
    if (!base) return;

    setError(null);
    patchUser(user.id, { force_password_reset: !user.force_password_reset });
    try {
      await apiClient.post(`${base}/${user.id}/force-password-reset`, {
        enabled: !user.force_password_reset,
      });
    } catch (err: unknown) {
      patchUser(user.id, { force_password_reset: user.force_password_reset });
      setError(extractErrorMessage(err, strings.errors.forceReset));
    }
  }

  async function handleResetPassword(user: DirectoryUser) {
    const confirmed = await confirmAction(strings.confirm.resetPassword(user.email), {
      title: strings.confirm.resetPasswordTitle,
      confirmText: "Reset Password",
      variant: "warning",
    });
    if (!confirmed) return;

    const path = passwordResetPath(user);
    if (!path) return;

    setError(null);
    try {
      const { data: result } = await apiClient.post<{ temporary_password?: string }>(path);
      if (!result?.temporary_password) {
        setPasswordNotice(null);
        setError(strings.errors.missingPassword);
        return;
      }
      setPasswordNotice({ email: user.email, temporary_password: result.temporary_password });
      await loadUsers();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.resetPassword));
    }
  }

  async function handleConfirmDelete() {
    if (!deletingUser) return;
    const base = ROLE_ACTIONS[deletingUser.role_name]?.base ?? memberActionBase(deletingUser);
    if (!base) return;

    setError(null);
    setDeleteLoading(true);
    try {
      await apiClient.delete(`${base}/${deletingUser.id}`);
      setDeletingUser(null);
      await loadUsers();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.delete));
    } finally {
      setDeleteLoading(false);
    }
  }

  const rows = data?.items ?? [];
  const rowActionBase = (user: DirectoryUser) =>
    ROLE_ACTIONS[user.role_name]?.base ?? memberActionBase(user);
  const rowDeleteBase = (user: DirectoryUser) =>
    ROLE_ACTIONS[user.role_name]?.base ?? (canDeleteMember(user) ? memberActionBase(user) : null);
  /** Owner rows are protected; every other row with a writable endpoint can be selected. */
  const selectableRows = rows.filter((user) => !user.is_owner && Boolean(rowActionBase(user)));

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
      current.size === selectableRows.length
        ? new Set()
        : new Set(selectableRows.map((user) => user.id))
    );
  }

  const selectedRows = selectableRows.filter((user) => selectedIds.has(user.id));

  async function handleBulkActive(active: boolean) {
    if (selectedRows.length === 0) return;
    const verb = active ? "activate" : "deactivate";
    const confirmed = await confirmAction(
      `${active ? "Activate" : "Deactivate"} ${selectedRows.length} selected account(s)?`,
      {
        title: strings.confirm.toggleTitle(!active),
        confirmText: active ? "Activate" : "Deactivate",
        variant: active ? "primary" : "warning",
      }
    );
    if (!confirmed) return;

    setBulkBusy(true);
    setError(null);
    const results = await Promise.allSettled(
      selectedRows.map((user) => {
        const base = rowActionBase(user);
        if (!base) return Promise.reject(new Error("No action endpoint"));
        return apiClient.post(`${base}/${user.id}/${active ? "reactivate" : "deactivate"}`);
      })
    );
    if (results.some((result) => result.status === "rejected")) {
      setError(strings.errors.toggleActive(verb));
    }
    setSelectedIds(new Set());
    setBulkBusy(false);
    await loadUsers();
  }

  async function handleBulkDelete() {
    const deletableRows = selectedRows.filter((user) => Boolean(rowDeleteBase(user)));
    if (deletableRows.length === 0) return;
    const confirmed = await confirmAction(
      `Permanently delete ${deletableRows.length} selected account(s)? This cannot be undone.`,
      { title: strings.confirm.deleteTitle, confirmText: "Delete", variant: "danger" }
    );
    if (!confirmed) return;

    setBulkBusy(true);
    setError(null);
    const results = await Promise.allSettled(
      deletableRows.map((user) => {
        const base = rowDeleteBase(user);
        if (!base) return Promise.reject(new Error("No delete endpoint"));
        return apiClient.delete(`${base}/${user.id}`);
      })
    );
    if (results.some((result) => result.status === "rejected")) {
      setError(strings.errors.delete);
    }
    setSelectedIds(new Set());
    setBulkBusy(false);
    await loadUsers();
  }

  async function handleExport(format: "pdf" | "excel") {
    if (!(await confirmExport(format, strings.tabs[activeRole]))) return;
    if (format === "pdf") exportUsersPDF(rows, activeRole, showInstitute);
    else exportUsersExcel(rows, activeRole, showInstitute);
  }

  const total = data?.total ?? 0;
  const visibleCount = data?.items.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const newRoute = NEW_ROUTE[activeRole];
  const showInstitute = activeRole !== "SUPER_ADMIN" && activeRole !== "SA_INSTRUCTOR";

  return (
    <div className="page">
      <div className="tab-bar">
        {DIRECTORY_ROLES.map((role) => {
          const count = data?.role_counts?.[role];
          return (
            <button
              key={role}
              type="button"
              className={`tab ${role === activeRole ? "active" : ""}`}
              onClick={() => navigate(`/super-admin/users/${SLUG_BY_ROLE[role]}`)}
            >
              {strings.tabs[role]}
              {count !== undefined && ` (${count})`}
            </button>
          );
        })}
      </div>

      <div className="filter-bar institutes-filter-bar">
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder={strings.searchPlaceholder}
          width={280}
        />

        <SearchableSelect
          options={[
            { value: "", label: strings.statusFilter.allStatuses },
            { value: "active", label: strings.statusFilter.active },
            { value: "inactive", label: strings.statusFilter.inactive },
          ]}
          value={statusFilter}
          onChange={(value) => {
            setStatusFilter(String(value));
            setPage(1);
          }}
          placeholder={strings.statusFilter.allStatuses}
          searchable={false}
          className="status-filter-select"
        />

        {activeRole === "STUDENT" && (
          <SearchableSelect
            options={[
              { value: "all", label: "All Students" },
              { value: "direct", label: "Direct Students" },
              { value: "institutes", label: "Institute Students" },
            ]}
            value={studentFilter}
            onChange={(value) => {
              setStudentFilter(value as any);
              setSelectedInstituteId("");
              setPage(1);
            }}
            placeholder="All Students"
            searchable={false}
            className="student-filter-select"
          />
        )}

        {activeRole === "STUDENT" && studentFilter === "institutes" && (
          <SearchableSelect
            options={[
              { value: "", label: "All Institutes" },
              ...institutes.map((inst) => ({ value: String(inst.id), label: inst.name })),
            ]}
            value={selectedInstituteId}
            onChange={(value) => {
              setSelectedInstituteId(String(value));
              setPage(1);
            }}
            placeholder="Filter by institute..."
            searchable={true}
            className="institute-filter-select"
          />
        )}

        {(activeRole === "INSTITUTE_ADMIN" || activeRole === "INST_INSTRUCTOR") && (
          <SearchableSelect
            options={[
              { value: "", label: "All Institutes" },
              ...institutes.map((inst) => ({ value: String(inst.id), label: inst.name })),
            ]}
            value={selectedInstituteId}
            onChange={(value) => {
              setSelectedInstituteId(String(value));
              setPage(1);
            }}
            placeholder="All Institutes"
            searchable={true}
            className="institute-filter-select"
          />
        )}

        <div className="directory-count-pill" aria-live="polite">
          {strings.filteredCount(visibleCount, total)}
        </div>

        <div className="export-btn-group">
          <button
            type="button"
            className="export-btn export-pdf"
            onClick={() => handleExport("pdf")}
            data-tooltip={strings.exportPdf}
          >
            <Icon name="filePdf" />
          </button>
          <button
            type="button"
            className="export-btn export-excel"
            onClick={() => handleExport("excel")}
            data-tooltip={strings.exportExcel}
          >
            <Icon name="spreadsheet" />
          </button>
        </div>

        {newRoute && (
          <Link to={newRoute} className="button-link">
            {strings.newLabel[activeRole as keyof typeof strings.newLabel]}
          </Link>
        )}

        {TENANT_NEW_PATH[activeRole] && (
          <button
            type="button"
            className="button-link"
            onClick={() => {
              setNewStudentInstituteId(selectedInstituteId);
              setShowInstituteModal(true);
            }}
          >
            {strings.newLabel[activeRole as keyof typeof strings.newLabel]}
          </button>
        )}
      </div>

      {selectedRows.length > 0 && (
        <div className="bulk-actions-bar">
          <span>
            <strong>{selectedRows.length}</strong> {strings.bulkActions.selectedSuffix}
          </span>
          <div className="bulk-actions-buttons">
            {selectedRows.some((user) => !user.is_active) ? (
              <Button variant="secondary" size="sm" disabled={bulkBusy} onClick={() => handleBulkActive(true)}>
                {strings.bulkActions.activate}
              </Button>
            ) : (
              <Button variant="secondary" size="sm" disabled={bulkBusy} onClick={() => handleBulkActive(false)}>
                {strings.bulkActions.deactivate}
              </Button>
            )}
            <Button variant="danger" size="sm" disabled={bulkBusy} onClick={handleBulkDelete}>
              {strings.bulkActions.delete}
            </Button>
            <Button variant="secondary" size="sm" disabled={bulkBusy} onClick={() => setSelectedIds(new Set())}>
              {strings.bulkActions.clear}
            </Button>
          </div>
        </div>
      )}

      {passwordNotice && (
        <div className="delivery-notice success" role="status" style={{ marginBottom: 20 }}>
          <span>
            {strings.passwordNotice.heading}{" "}
            {strings.passwordNotice.forEmail(passwordNotice.email)}:{" "}
            <code>{passwordNotice.temporary_password}</code>
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigator.clipboard.writeText(passwordNotice.temporary_password)}
            >
              {strings.passwordNotice.copy}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setPasswordNotice(null)}
            >
              {strings.passwordNotice.dismiss}
            </button>
          </div>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      {loading && !data ? (
        <p>{strings.loading}</p>
      ) : (
        <>
          <UsersTable
            users={data?.items ?? []}
            currentUserId={currentUser?.id}
            showInstitute={showInstitute}
            onToggleActive={handleToggleActive}
            onForceReset={handleForceReset}
            onResetPassword={handleResetPassword}
            onRequestDelete={setDeletingUser}
            selectableRows={selectableRows}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
          />

          {totalPages > 1 && (
            <div className="pagination">
              <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                {strings.pagination.prev}
              </button>
              <span>{strings.pagination.pageOf(page, totalPages, total)}</span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                {strings.pagination.next}
              </button>
            </div>
          )}
        </>
      )}

      <ConfirmModal
        isOpen={Boolean(deletingUser)}
        title={strings.confirm.deleteTitle}
        message={deletingUser ? strings.confirm.delete(deletingUser.email) : ""}
        confirmText="Delete"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingUser(null)}
      />

      <ConfirmModal
        isOpen={showInstituteModal}
        title={strings.selectInstituteModal.title}
        message={
          <div style={{ marginTop: 12 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
              {strings.selectInstituteModal.label}
            </label>
            <SearchableSelect
              options={institutes.map((inst) => ({ value: String(inst.id), label: inst.name }))}
              value={newStudentInstituteId}
              onChange={(val) => setNewStudentInstituteId(String(val))}
              placeholder="Search and select an institute..."
              searchable={true}
            />
          </div>
        }
        confirmText={strings.selectInstituteModal.continue}
        cancelText={strings.selectInstituteModal.cancel}
        variant="primary"
        onConfirm={() => {
          const buildPath = TENANT_NEW_PATH[activeRole];
          if (newStudentInstituteId && buildPath) navigate(buildPath(newStudentInstituteId));
        }}
        onClose={() => {
          setShowInstituteModal(false);
          setNewStudentInstituteId("");
        }}
      />
    </div>
  );
}
