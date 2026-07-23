import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiClient } from "../../api/client";
import { confirmDelete } from "../../components/confirmDialog";
import { Icon } from "../../components/icons";
import { extractErrorMessage } from "../../api/errors";
import { useAuthStore } from "../../store/authStore";
import type { InstituteMember } from "./InstituteMembers";

interface DeviceRecord {
  id: number;
  name: string | null;
  user_agent: string | null;
  last_ip_address: string | null;
  login_count: number;
  first_seen_at: string;
  last_seen_at: string;
  is_active: boolean;
}

interface AttemptRecord {
  id: number;
  module_title: string;
  module_type: string;
  status: string;
  started_at: string;
  submitted_at: string | null;
  graded_at: string | null;
  raw_score: string | null;
  max_score: string | null;
  graders: Array<{ id: number | null; name: string; email: string | null; part: string; status: string; graded_at: string | null }>;
}

interface StudentOverviewData {
  student: InstituteMember;
  security: { device_count: number; active_session_count: number; last_login_at: string | null; devices: DeviceRecord[] };
  attempts: AttemptRecord[];
}

function dateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : "-";
}

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
      setError(extractErrorMessage(err, "Failed to load the student record."));
    }
  }, [apiBase, id]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus() {
    if (!data) return;
    await apiClient.post(`${apiBase}/members/${id}/${data.student.is_active ? "deactivate" : "reactivate"}`);
    await load();
  }

  async function revokeSessions() {
    if (!window.confirm("Sign this student out from the active device?")) return;
    await apiClient.post(`${apiBase}/students/${id}/revoke-sessions`);
    await load();
  }

  async function resetPassword() {
    if (!window.confirm("Reset this student's password and sign out the active device?")) return;
    const response = await apiClient.post(`${apiBase}/members/${id}/reset-password`);
    setTemporaryPassword(response.data.temporary_password);
    await load();
  }

  async function archive() {
    if (!await confirmDelete("Are you sure you want to delete this student account? Test and device history will be retained.", "Delete Student Account")) return;
    await apiClient.delete(`${apiBase}/members/${id}`);
    await load();
  }

  if (error && !data) return <div><p className="error-text">{error}</p><Link to={basePath}>Back to students</Link></div>;
  if (!data) return <p>Loading...</p>;
  const { student, security, attempts } = data;

  return (
    <div>
      <div className="page-header">
        <div><span className="page-eyebrow">Student record</span><h1>{student.first_name} {student.last_name}</h1><p className="page-subtitle">{student.email}</p></div>
        <div className="page-header-actions"><Link className="secondary-action link-action" to={basePath}>Back</Link>{!student.deleted_at && canManage && <Link className="secondary-action link-action" to={`${basePath}/${student.id}/edit`}>Edit</Link>}</div>
      </div>
      {error && <p className="error-text">{error}</p>}

      <div className="stat-tile-row">
        <div className="stat-tile"><p className="stat-label">Tests taken</p><p className="stat-value">{attempts.length}</p></div>
        <div className="stat-tile"><p className="stat-label">Devices used</p><p className="stat-value">{security.device_count}</p></div>
        <div className="stat-tile"><p className="stat-label">Active devices</p><p className="stat-value">{security.active_session_count}</p></div>
        <div className="stat-tile"><p className="stat-label">Last login</p><p className="stat-value stat-value-date">{dateTime(security.last_login_at)}</p></div>
      </div>

      <section className="student-control-bar">
        <div><span className={`badge ${student.deleted_at ? "badge-gray" : student.is_active ? "badge-green" : "badge-inactive"}`}>{student.deleted_at ? "Deleted" : student.is_active ? "Active" : "Inactive"}</span><span>{student.phone_number ?? "No phone number"}</span></div>
        {!student.deleted_at && <div className="table-actions">{canManage && <button onClick={resetPassword} aria-label="Reset password" data-tooltip="Reset password"><Icon name="lock" /></button>}{canRevokeSessions && <button disabled={!security.active_session_count} onClick={revokeSessions} aria-label="Sign out device" data-tooltip="Sign out device"><Icon name="revoke" /></button>}{canManage && <button onClick={updateStatus} aria-label={student.is_active ? "Deactivate student" : "Reactivate student"} data-tooltip={student.is_active ? "Deactivate student" : "Reactivate student"}><Icon name={student.is_active ? "toggleOff" : "toggleOn"} /></button>}{canManage && <button className="danger" onClick={archive} aria-label="Delete student" data-tooltip="Delete student"><Icon name="trash" /></button>}</div>}
      </section>

      <section className="student-record-section">
        <div className="section-heading"><div><span className="page-eyebrow">Security</span><h2>Device history</h2></div></div>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Device</th><th>First login</th><th>Last login</th><th>Logins</th><th>Last IP</th><th>Status</th></tr></thead><tbody>{security.devices.length === 0 ? <tr><td colSpan={6} className="empty-cell">This student has not logged in yet.</td></tr> : security.devices.map((device) => <tr key={device.id}><td><strong>{device.name ?? "Unknown device"}</strong><span className="device-agent">{device.user_agent}</span></td><td>{dateTime(device.first_seen_at)}</td><td>{dateTime(device.last_seen_at)}</td><td>{device.login_count}</td><td>{device.last_ip_address ?? "-"}</td><td><span className={`badge ${device.is_active ? "badge-green" : "badge-gray"}`}>{device.is_active ? "Active" : "Signed out"}</span></td></tr>)}</tbody></table></div>
      </section>

      <section className="student-record-section">
        <div className="section-heading"><div><span className="page-eyebrow">Assessment</span><h2>Test and grading history</h2></div></div>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Test</th><th>Started</th><th>Status</th><th>Score</th><th>Checked by</th></tr></thead><tbody>{attempts.length === 0 ? <tr><td colSpan={5} className="empty-cell">No tests taken.</td></tr> : attempts.map((attempt) => <tr key={attempt.id}><td><strong>{attempt.module_title}</strong><span className="device-agent">{attempt.module_type.replaceAll("_", " ")}</span></td><td>{dateTime(attempt.started_at)}</td><td><span className="badge">{attempt.status.replaceAll("_", " ")}</span></td><td>{attempt.raw_score !== null ? `${attempt.raw_score} / ${attempt.max_score ?? "-"}` : "Pending"}</td><td>{attempt.graders.length ? <div className="grader-list">{attempt.graders.map((grader, index) => <span key={`${grader.id}-${grader.part}-${index}`}><strong>{grader.name}</strong> · {grader.part}</span>)}</div> : attempt.status === "graded" ? "Auto-graded" : "Awaiting grading"}</td></tr>)}</tbody></table></div>
      </section>

      {temporaryPassword && <div className="modal-backdrop" onClick={() => setTemporaryPassword(null)}><div className="modal-card" onClick={(event) => event.stopPropagation()}><h2>Temporary password</h2><div className="credential-row"><span>Password</span><code>{temporaryPassword}</code></div><div className="form-actions"><button onClick={() => navigator.clipboard.writeText(temporaryPassword)}>Copy password</button><button type="button" onClick={() => setTemporaryPassword(null)}>Done</button></div></div></div>}
    </div>
  );
}

export function SuperAdminStudentOverview() {
  const { id } = useParams();
  return <StudentOverview instituteId={Number(id)} />;
}
