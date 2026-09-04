import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { confirmAction, confirmDelete } from "@/components/confirmDialog";
import { DEVELOPER_ACCESS_SLUG } from "@/config/developerAccess";
import { useAuthStore } from "@/store/authStore";
import { RouteLoadingState } from "@/components/RouteLoadingState";
import { studentOverviewStrings as strings } from "./StudentOverview.strings";
import type { StudentOverviewData } from "./types";
import { StudentHeader } from "./components/StudentHeader";
import { StudentStatTiles } from "./components/StudentStatTiles";
import { StudentControlBar } from "./components/StudentControlBar";
import { DeviceHistorySection } from "./components/DeviceHistorySection";
import { TestHistorySection } from "./components/TestHistorySection";
import { StudentCredentialModal } from "./components/StudentCredentialModal";

export function StudentOverview({ instituteId, portalBasePath = "/super-admin" }: { instituteId?: number; portalBasePath?: string }) {
  const params = useParams();
  // Super Admins reach this screen from two routes that name the parameter
  // differently: .../students/:studentId and .../accounts/students/:memberId.
  const id = instituteId === undefined ? params.id : (params.studentId ?? params.memberId);
  const permissions = useAuthStore((state) => state.user?.institute_permissions);
  const isSuperAdmin = instituteId !== undefined;
  const apiBase = isSuperAdmin ? `/super-admin/institutes/${instituteId}` : "/institute";
  // Return to whichever list the student was opened from.
  const cameFromAccounts = params.memberId !== undefined;
  const basePath = isSuperAdmin
    ? `${portalBasePath}/institutes/${instituteId}/${cameFromAccounts ? "accounts" : "students"}`
    : "/institute-portal/students";
  const canManage = isSuperAdmin || permissions?.manage_students;
  const canRevokeSessions = isSuperAdmin || permissions?.manage_student_sessions;
  const [data, setData] = useState<StudentOverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await apiClient.get<StudentOverviewData>(`${apiBase}/students/${id}/overview`);
      setData(response.data);
      setError(null);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.load));
    }
  }, [apiBase, id]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus() {
    if (!data) return;
    const isDeactivating = data.student.is_active;
    const confirmed = await confirmAction(strings.confirm.toggleStatus(isDeactivating ? "deactivate" : "activate", `${data.student.first_name} ${data.student.last_name}`), {
      title: isDeactivating ? strings.confirm.deactivateTitle : strings.confirm.activateTitle,
      confirmText: isDeactivating ? "Deactivate" : "Activate",
      variant: isDeactivating ? "warning" : "primary",
    });
    if (!confirmed) return;
    try {
      await apiClient.post(`${apiBase}/members/${id}/${isDeactivating ? "deactivate" : "reactivate"}`);
      setError(null);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.updateStatus));
      return;
    }
    await load();
  }

  async function revokeSessions() {
    const confirmed = await confirmAction(strings.confirm.revokeSessions, {
      title: strings.confirm.revokeSessionsTitle,
      confirmText: strings.confirm.revokeSessionsConfirm,
      variant: "warning",
    });
    if (!confirmed) return;
    // The page already has an error banner; these three actions simply never
    // fed it, so a rejected request left the view unchanged and silent - which
    // reads as "nothing happened" rather than "that failed".
    try {
      await apiClient.post(`${apiBase}/students/${id}/revoke-sessions`);
      setError(null);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.revokeSessions));
      return;
    }
    await load();
  }

  async function resetPassword() {
    const confirmed = await confirmAction(strings.confirm.resetPassword, {
      title: strings.confirm.resetPasswordTitle,
      confirmText: strings.confirm.resetPasswordConfirm,
      variant: "warning",
    });
    if (!confirmed) return;
    try {
      const response = await apiClient.post(`${apiBase}/members/${id}/reset-password`);
      setTemporaryPassword(response.data.temporary_password);
      setError(null);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.resetPassword));
      return;
    }
    await load();
  }

  async function archive() {
    if (!await confirmDelete(strings.confirm.deleteStudent, strings.confirm.deleteStudentTitle)) return;
    try {
      await apiClient.delete(`${apiBase}/members/${id}`);
      setError(null);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.deleteStudent));
      return;
    }
    await load();
  }

  if (error && !data) {
    return (
      <div>
        <p className="error-text">{error}</p>
        <Link to={basePath}>{strings.backToStudents}</Link>
      </div>
    );
  }
  if (!data) return <RouteLoadingState />;
  const { student, security, attempts } = data;

  return (
    <div>
      <StudentHeader student={student} basePath={basePath} canManage={canManage} />
      {error && <p className="error-text">{error}</p>}

      <StudentStatTiles
        testsTaken={attempts.length}
        deviceCount={security.device_count}
        activeSessionCount={security.active_session_count}
        lastLoginAt={security.last_login_at}
      />

      <StudentControlBar
        student={student}
        activeSessionCount={security.active_session_count}
        canManage={canManage}
        canRevokeSessions={canRevokeSessions}
        onResetPassword={resetPassword}
        onRevokeSessions={revokeSessions}
        onToggleActive={updateStatus}
        onArchive={archive}
      />

      <DeviceHistorySection devices={security.devices} />
      <TestHistorySection attempts={attempts} />

      {temporaryPassword && (
        <StudentCredentialModal password={temporaryPassword} onClose={() => setTemporaryPassword(null)} />
      )}
    </div>
  );
}

export function SuperAdminStudentOverview() {
  const { id } = useParams();
  return <StudentOverview instituteId={Number(id)} />;
}

const developerAccessSlug = DEVELOPER_ACCESS_SLUG;

export function DeveloperStudentOverview() {
  const { id } = useParams();
  return <StudentOverview instituteId={Number(id)} portalBasePath={`/${developerAccessSlug}`} />;
}
