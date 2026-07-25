import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { confirmDelete } from "@/components/confirmDialog";
import { useAuthStore } from "@/store/authStore";
import { studentOverviewStrings as strings } from "./StudentOverview.strings";
import type { StudentOverviewData } from "./types";
import { StudentHeader } from "./components/StudentHeader";
import { StudentStatTiles } from "./components/StudentStatTiles";
import { StudentControlBar } from "./components/StudentControlBar";
import { DeviceHistorySection } from "./components/DeviceHistorySection";
import { TestHistorySection } from "./components/TestHistorySection";
import { StudentCredentialModal } from "./components/StudentCredentialModal";

export function StudentOverview({ instituteId }: { instituteId?: number }) {
  const params = useParams();
  const id = instituteId === undefined ? params.id : params.studentId;
  const permissions = useAuthStore((state) => state.user?.institute_permissions);
  const isSuperAdmin = instituteId !== undefined;
  const apiBase = isSuperAdmin ? `/super-admin/institutes/${instituteId}` : "/institute";
  const basePath = isSuperAdmin
    ? `/super-admin/institutes/${instituteId}/students`
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
    await apiClient.post(`${apiBase}/members/${id}/${data.student.is_active ? "deactivate" : "reactivate"}`);
    await load();
  }

  async function revokeSessions() {
    if (!window.confirm(strings.confirm.revokeSessions)) return;
    await apiClient.post(`${apiBase}/students/${id}/revoke-sessions`);
    await load();
  }

  async function resetPassword() {
    if (!window.confirm(strings.confirm.resetPassword)) return;
    const response = await apiClient.post(`${apiBase}/members/${id}/reset-password`);
    setTemporaryPassword(response.data.temporary_password);
    await load();
  }

  async function archive() {
    if (!await confirmDelete(strings.confirm.deleteStudent, strings.confirm.deleteStudentTitle)) return;
    await apiClient.delete(`${apiBase}/members/${id}`);
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
  if (!data) return <p>{strings.loading}</p>;
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
