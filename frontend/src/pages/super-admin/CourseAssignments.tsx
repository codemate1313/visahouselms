import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL, apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import type { Course } from "../../api/types";

interface Institute { id: number; name: string; is_active: boolean; subscription_state: string }

export function CourseAssignments() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function load() { try { const [{ data: courseData }, { data: instituteData }] = await Promise.all([apiClient.get<Course>(`/super-admin/courses/${id}`), apiClient.get<Institute[]>("/super-admin/institutes")]); setCourse(courseData); setInstitutes(instituteData); } catch { setError("Failed to load course assignments."); } }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);
  async function assign(event: FormEvent) { event.preventDefault(); if (!selected) return; setSaving(true); setError(null); try { await apiClient.post(`/super-admin/courses/${id}/assignments`, { institute_id: Number(selected) }); setSelected(""); await load(); } catch (err) { setError(extractErrorMessage(err, "Failed to assign course.")); } finally { setSaving(false); } }
  async function unassign(instituteId: number) { if (!window.confirm("Revoke this course from the institute?")) return; try { await apiClient.delete(`/super-admin/courses/${id}/assignments/${instituteId}`); await load(); } catch (err) { setError(extractErrorMessage(err, "Failed to revoke course.")); } }
  async function toggleVisibility() { try { await apiClient.patch(`/super-admin/courses/${id}/visibility`, { is_visible: !course?.is_visible }); await load(); } catch (err) { setError(extractErrorMessage(err, "Failed to update visibility.")); } }
  async function changeStatus(status: string) { try { await apiClient.post(`/super-admin/courses/${id}/status`, { status }); await load(); } catch (err) { setError(extractErrorMessage(err, "Failed to update status.")); } }
  async function removeCourse() { if (!window.confirm(`Delete "${course?.title}" and revoke all active access? Historical records will be retained.`)) return; try { await apiClient.delete(`/super-admin/courses/${id}`); navigate("/super-admin/courses"); } catch (err) { setError(extractErrorMessage(err, "Failed to delete course.")); } }
  if (!course && !error) return <p>Loading...</p>;
  if (!course) return <p className="error-text">{error}</p>;
  const activeIds = new Set(course.assignments?.filter((item) => item.is_active).map((item) => item.institute_id));
  const available = institutes.filter((item) => item.is_active && !activeIds.has(item.id));

  return <div><div className="page-header"><div><h1>{course.title}</h1><p className="page-subtitle">Control website visibility, lifecycle, and institute access.</p></div><Link to="/super-admin/courses">Back to hierarchy</Link></div>
    {error && <p className="error-text">{error}</p>}
    <div className="form-actions course-admin-actions"><button onClick={toggleVisibility}>{course.is_visible ? "Hide from website" : "Show on website"}</button>{course.status !== "published" && <button onClick={() => changeStatus("published")}>Publish</button>}{course.status === "published" && <button className="secondary-button" onClick={() => changeStatus("archived")}>Archive</button>}<button className="danger" onClick={removeCourse}>Delete course</button></div>
    <div className="course-overview"><div><span className={`badge ${course.status === "published" ? "badge-green" : course.status === "draft" ? "badge-amber" : "badge-gray"}`}>{course.status}</span>{!course.is_visible && <span className="badge badge-gray">hidden</span>}<h2>{course.summary || "No summary"}</h2><p>{course.description || "No description provided."}</p></div><dl><div><dt>Instructor</dt><dd>{course.created_by_name}</dd></div><div><dt>Created</dt><dd>{new Date(course.created_at).toLocaleString()}</dd></div><div><dt>Published</dt><dd>{course.published_at ? new Date(course.published_at).toLocaleString() : "Not published"}</dd></div><div><dt>Modules</dt><dd>{course.modules.length}</dd></div></dl></div>
    <div className="assignment-grid"><section className="workspace-panel"><h2>Assign to institute</h2>{course.status !== "published" ? <div className="banner warning">Publish the course before assigning it.</div> : <form onSubmit={assign}><label htmlFor="institute">Institute</label><select id="institute" value={selected} onChange={(event) => setSelected(event.target.value)} required><option value="">Select an active institute...</option>{available.map((item) => <option value={item.id} key={item.id}>{item.name} ({item.subscription_state})</option>)}</select><button className="top-gap" disabled={saving || !selected}>{saving ? "Assigning..." : "Grant access"}</button></form>}</section><section className="workspace-panel"><h2>Course resources</h2>{course.assets.length ? <ul className="resource-links">{course.assets.map((asset) => <li key={asset.id}><span className={`asset-icon ${asset.asset_type}`}>{asset.asset_type.toUpperCase()}</span><a href={`${API_BASE_URL}${asset.file_url}`} target="_blank" rel="noreferrer">{asset.title}</a></li>)}</ul> : <p className="empty-message">No resources uploaded.</p>}</section></div>
    <h2 className="section-title">Institute access history</h2><table className="data-table"><thead><tr><th>Institute</th><th>Assigned</th><th>Status</th><th /></tr></thead><tbody>{!course.assignments?.length ? <tr><td colSpan={4} className="empty-cell">Not assigned to any institute.</td></tr> : course.assignments.map((item) => <tr key={item.id}><td>{item.institute_name}</td><td>{new Date(item.assigned_at).toLocaleDateString()}</td><td><span className={`badge ${item.is_active ? "badge-green" : "badge-gray"}`}>{item.is_active ? "Active" : "Revoked"}</span></td><td className="table-actions">{item.is_active && <button className="danger" onClick={() => unassign(item.institute_id)}>Revoke</button>}</td></tr>)}</tbody></table>
  </div>;
}
