import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import { useAuthStore } from "../../store/authStore";

export interface InstituteMember {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: "STUDENT" | "INST_INSTRUCTOR";
  is_active: boolean;
  force_password_reset: boolean;
  phone_number: string | null;
  address: string | null;
  deleted_at: string | null;
  attempt_count: number;
  device_count: number;
  active_session_count: number;
  created_at: string;
}

interface ImportResult {
  summary: { total_rows: number; created: number; skipped: number; remaining_slots: number };
  created: Array<{ id: number; email: string; first_name: string; last_name: string; temporary_password: string }>;
  skipped: Array<{ row: number; email: string | null; reason: string }>;
}

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
  const canProvision = (isSuperAdmin && (isStudent || isAllAccounts)) || (!isSuperAdmin && isStudent && Boolean(permissions?.manage_students));
  const canManage = isSuperAdmin || (isStudent ? permissions?.manage_students : permissions?.manage_staff);
  const canViewActivity = isSuperAdmin || permissions?.view_student_activity;
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
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<InstituteMember[]>(`${apiBase}/members`, {
        params: {
          role: (role ?? roleFilter) || undefined,
          search: search || undefined,
          status: statusFilter || undefined,
          has_attempts: activityFilter === "attempts" ? true : activityFilter === "no_attempts" ? false : undefined,
          has_devices: sessionFilter === "known_devices" ? true : sessionFilter === "no_devices" ? false : undefined,
          has_active_sessions: sessionFilter === "active_session" ? true : undefined,
        },
      });
      setMembers(data);
      setError(null);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, `Failed to load ${label.toLowerCase()}.`));
    } finally {
      setLoading(false);
    }
  }, [activityFilter, apiBase, label, role, roleFilter, search, sessionFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function toggle(member: InstituteMember) {
    try {
      await apiClient.post(`${apiBase}/members/${member.id}/${member.is_active ? "deactivate" : "reactivate"}`);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to update the member status."));
    }
  }

  async function resetPassword(member: InstituteMember) {
    if (!window.confirm(`Reset the password for ${member.email}?`)) return;
    try {
      const { data } = await apiClient.post(`${apiBase}/members/${member.id}/reset-password`);
      setCredential({ name: `${member.first_name} ${member.last_name}`, password: data.temporary_password });
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to reset the password."));
    }
  }

  async function remove(member: InstituteMember) {
    if (!window.confirm(`Delete ${member.email}? The account will be signed out while its test history is retained.`)) return;
    try {
      await apiClient.delete(`${apiBase}/members/${member.id}`);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to delete the member."));
    }
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
      setError(extractErrorMessage(err, "Failed to import students."));
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
      <div className="page-header">
        <div><span className="page-eyebrow">People</span><h1>{label}</h1><p className="page-subtitle">Manage and inspect institute accounts from one place.</p></div>
        <div className="page-header-actions">
          {canProvision && <button className="secondary-action" type="button" onClick={downloadTemplate}>Download template</button>}
          {canProvision && <button className="secondary-action" type="button" onClick={() => fileInput.current?.click()}>Import CSV / Excel</button>}
          {isSuperAdmin && <Link className="button-link" to={`${basePath}/students/new`}>Add student</Link>}
          {isSuperAdmin && <Link className="button-link secondary-button" to={`${basePath}/staff/new`}>Add instructor</Link>}
          {!isSuperAdmin && isStudent && canManage && <Link className="button-link" to={`${basePath}/new`}>Add student</Link>}
          {!isSuperAdmin && !isStudent && canManage && <Link className="button-link" to={`${basePath}/new`}>Add instructor</Link>}
          {canProvision && <input ref={fileInput} className="visually-hidden" type="file" accept=".csv,.xlsx" onChange={(event) => event.target.files?.[0] && importFile(event.target.files[0])} />}
        </div>
      </div>

      <div className={`filter-row ${isAllAccounts ? "accounts-filter-row" : ""}`}>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${label.toLowerCase()}...`} />
        {isAllAccounts && (
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="">All account types</option>
            <option value="STUDENT">Students</option>
            <option value="INST_INSTRUCTOR">Institute instructors</option>
          </select>
        )}
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="deleted">Deleted</option>
          <option value="password_reset">Password reset pending</option>
        </select>
        <select value={activityFilter} onChange={(event) => setActivityFilter(event.target.value)}>
          <option value="">Any test activity</option>
          <option value="attempts">Has test attempts</option>
          <option value="no_attempts">No test attempts</option>
        </select>
        <select value={sessionFilter} onChange={(event) => setSessionFilter(event.target.value)}>
          <option value="">Any device/session</option>
          <option value="active_session">Currently signed in</option>
          <option value="known_devices">Known devices</option>
          <option value="no_devices">No known devices</option>
        </select>
      </div>
      {error && <p className="error-text">{error}</p>}

      {loading ? <p>Loading...</p> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Email</th>{isAllAccounts && <th>Type</th>}<th>Tests</th><th>Devices</th><th>Contact</th><th>Status</th><th>Created</th><th /></tr></thead>
            <tbody>
              {members.length === 0 && <tr><td colSpan={9} className="empty-cell">No {label.toLowerCase()} found.</td></tr>}
              {members.map((member) => (
                <tr key={member.id}>
                  <td><strong>{member.first_name} {member.last_name}</strong>{member.force_password_reset && <span className="badge badge-amber">password reset</span>}</td>
                  <td>{member.email}</td>
                  {isAllAccounts && <td>{member.role === "STUDENT" ? "Student" : "Instructor"}</td>}
                  <td>{member.attempt_count}</td>
                  <td>{member.device_count}<span className="muted-text device-active-label">{member.active_session_count ? `${member.active_session_count} active` : ""}</span></td>
                  <td>{member.phone_number ?? "-"}</td>
                  <td><span className={`badge ${member.deleted_at ? "badge-gray" : member.is_active ? "badge-green" : "badge-amber"}`}>{member.deleted_at ? "Deleted" : member.is_active ? "Active" : "Inactive"}</span></td>
                  <td>{new Date(member.created_at).toLocaleDateString()}</td>
                  <td className="table-actions">
                    {member.role === "STUDENT" && canViewActivity && <Link to={`${basePath}/students/${member.id}`}>View</Link>}
                    {canManage && <Link to={`${basePath}/${member.role === "STUDENT" ? "students" : "staff"}/${member.id}/edit`}>Edit</Link>}
                    {!member.deleted_at && canManage && <button onClick={() => resetPassword(member)}>Reset password</button>}
                    {!member.deleted_at && canManage && <button onClick={() => toggle(member)}>{member.is_active ? "Deactivate" : "Reactivate"}</button>}
                    {!member.deleted_at && canManage && <button className="danger" onClick={() => remove(member)}>Delete</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {credential && (
        <div className="modal-backdrop" onClick={() => setCredential(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <h2>Temporary password</h2>
            <p className="hint">Share this with {credential.name}. It will not be shown again.</p>
            <div className="credential-row"><span>Password</span><code>{credential.password}</code></div>
            <div className="form-actions"><button onClick={() => navigator.clipboard.writeText(credential.password)}>Copy password</button><button type="button" onClick={() => setCredential(null)}>Done</button></div>
          </div>
        </div>
      )}

      {importResult && (
        <div className="modal-backdrop" onClick={() => setImportResult(null)}>
          <div className="modal-card import-result-modal" onClick={(event) => event.stopPropagation()}>
            <div className="panel-heading"><div><h2>Student import</h2><p>{importResult.summary.created} created, {importResult.summary.skipped} skipped, {importResult.summary.remaining_slots} slots remaining.</p></div><button className="modal-close" type="button" aria-label="Close" onClick={() => setImportResult(null)}>×</button></div>
            {importResult.created.length > 0 && <div className="import-result-section"><div className="panel-heading"><h3>Credentials</h3><button type="button" onClick={downloadCredentials}>Download CSV</button></div><div className="table-wrap compact-table-wrap"><table className="data-table"><thead><tr><th>Student</th><th>Email</th><th>Temporary password</th></tr></thead><tbody>{importResult.created.map((item) => <tr key={item.id}><td>{item.first_name} {item.last_name}</td><td>{item.email}</td><td><code>{item.temporary_password}</code></td></tr>)}</tbody></table></div></div>}
            {importResult.skipped.length > 0 && <div className="import-result-section"><h3>Skipped rows</h3><div className="table-wrap compact-table-wrap"><table className="data-table"><thead><tr><th>Row</th><th>Email</th><th>Reason</th></tr></thead><tbody>{importResult.skipped.map((item) => <tr key={`${item.row}-${item.email}`}><td>{item.row}</td><td>{item.email ?? "-"}</td><td>{item.reason}</td></tr>)}</tbody></table></div></div>}
          </div>
        </div>
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
