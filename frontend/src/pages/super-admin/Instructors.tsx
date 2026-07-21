import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import { confirmDelete } from "../../components/ConfirmModal";
import type { InstructorAccount, InstructorPasswordReset } from "../../api/types";

interface PasswordNotice {
  email: string;
  temporary_password: string;
}

function extractTemporaryPassword(data: InstructorPasswordReset): string {
  const response = data as InstructorPasswordReset & {
    temp_password?: string;
    temporaryPassword?: string;
  };
  return response.temporary_password || response.temp_password || response.temporaryPassword || "";
}

export function Instructors() {
  const [instructors, setInstructors] = useState<InstructorAccount[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<PasswordNotice | null>(null);

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
      setError("Failed to load instructors.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInstructors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    loadInstructors();
  }

  async function toggleActive(instructor: InstructorAccount) {
    const action = instructor.is_active ? "deactivate" : "reactivate";
    if (instructor.is_active && !window.confirm(`Deactivate ${instructor.email}? Their active sessions will be revoked.`)) return;
    setError(null);
    try {
      await apiClient.post(`/super-admin/instructors/${instructor.id}/${action}`);
      await loadInstructors();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, `Failed to ${action} instructor.`));
    }
  }

  async function resetPassword(instructor: InstructorAccount) {
    if (!window.confirm(`Reset the password for ${instructor.email}? Their active sessions will be revoked.`)) return;
    setError(null);
    try {
      const { data } = await apiClient.post<InstructorPasswordReset>(`/super-admin/instructors/${instructor.id}/reset-password`);
      const temporaryPassword = extractTemporaryPassword(data);
      if (!temporaryPassword) {
        setPasswordNotice(null);
        setError("Temporary password was not returned by the server. Restart the backend and try Reset Password again.");
        return;
      }
      setPasswordNotice({ email: instructor.email, temporary_password: temporaryPassword });
      await loadInstructors();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to reset password."));
    }
  }

  async function copyTemporaryPassword() {
    if (!passwordNotice) return;
    if (!passwordNotice.temporary_password) {
      setError("No temporary password is available to copy. Try Reset Password again after restarting the backend.");
      return;
    }
    await navigator.clipboard.writeText(passwordNotice.temporary_password);
  }

  async function deleteInstructor(instructor: InstructorAccount) {
    if (!await confirmDelete(`Are you sure you want to permanently delete instructor "${instructor.email}"? This action cannot be undone.`, "Delete Instructor")) return;
    setError(null);
    try {
      await apiClient.delete(`/super-admin/instructors/${instructor.id}`);
      await loadInstructors();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to delete instructor."));
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>SA Instructors</h1>
          <p className="page-subtitle">Manage the central team that creates assessment modules and mock tests.</p>
        </div>
        <Link to="/super-admin/instructors/new" className="button-link">+ New Instructor</Link>
      </div>

      {passwordNotice && (
        <div className="delivery-notice success" role="status">
          <span>Temporary password for {passwordNotice.email}: <code>{passwordNotice.temporary_password}</code></span>
          <button className="secondary-button" onClick={copyTemporaryPassword}>Copy</button>
          <button className="secondary-button" onClick={() => setPasswordNotice(null)}>Dismiss</button>
        </div>
      )}

      <form className="filter-bar" onSubmit={handleSearch}>
        <input
          aria-label="Search instructors"
          placeholder="Search name, email, or title..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button type="submit">Search</button>
      </form>

      {error && <p className="error-text">{error}</p>}
      {loading ? <p>Loading...</p> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Instructor</th><th>Status</th><th>Created</th><th /></tr></thead>
            <tbody>
              {instructors.length === 0 ? (
                <tr><td colSpan={4} className="empty-cell">No instructors match these filters.</td></tr>
              ) : instructors.map((instructor) => (
                <tr key={instructor.id}>
                  <td><strong>{instructor.first_name} {instructor.last_name}</strong><br /><span className="muted-text">{instructor.title} · {instructor.email}</span></td>
                  <td>
                    <span className={`badge ${instructor.is_active ? "badge-green" : "badge-gray"}`}>{instructor.is_active ? "Active" : "Inactive"}</span>
                    {instructor.force_password_reset && <span className="badge badge-amber">reset required</span>}
                  </td>
                  <td>{new Date(instructor.created_at).toLocaleDateString()}</td>
                  <td className="table-actions">
                    <Link to={`/super-admin/instructors/${instructor.id}`}>Edit</Link>
                    <button onClick={() => resetPassword(instructor)}>Reset Password</button>
                    <button onClick={() => toggleActive(instructor)}>{instructor.is_active ? "Deactivate" : "Reactivate"}</button>
                    <button className="danger" onClick={() => deleteInstructor(instructor)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
