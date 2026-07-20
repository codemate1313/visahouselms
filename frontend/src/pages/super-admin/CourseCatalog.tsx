import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../api/client";
import type { Course } from "../../api/types";

const STATUS_CLASS: Record<string, string> = { draft: "badge-amber", published: "badge-green", archived: "badge-gray" };

export function CourseCatalog() {
  const [courses, setCourses] = useState<Course[]>([]); const [search, setSearch] = useState(""); const [statusFilter, setStatusFilter] = useState(""); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  async function load() { setLoading(true); try { const { data } = await apiClient.get<Course[]>("/super-admin/courses", { params: { search: search || undefined, status: statusFilter || undefined } }); setCourses(data); setError(null); } catch { setError("Failed to load course catalog."); } finally { setLoading(false); } }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [statusFilter]);
  function searchCourses(event: FormEvent) { event.preventDefault(); load(); }
  return <div><div className="page-header"><div><h1>Course Catalog</h1><p className="page-subtitle">Review instructor-authored courses and control institute availability.</p></div></div><form className="filter-bar" onSubmit={searchCourses}><input placeholder="Search title or slug..." value={search} onChange={(e) => setSearch(e.target.value)} /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All statuses</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select><button type="submit">Search</button></form>{error && <p className="error-text">{error}</p>}{loading ? <p>Loading...</p> : <table className="data-table"><thead><tr><th>Course</th><th>Instructor</th><th>Resources</th><th>Institutes</th><th>Price</th><th>Status</th><th /></tr></thead><tbody>{courses.length === 0 ? <tr><td colSpan={7} className="empty-cell">No courses found.</td></tr> : courses.map((course) => <tr key={course.id}><td><strong>{course.title}</strong><br /><span className="muted-text">/{course.slug}</span></td><td>{course.created_by_name}<br /><span className="muted-text">{course.created_by_email}</span></td><td>{course.asset_count}</td><td>{course.assignment_count}</td><td>{course.currency} {Number(course.price).toLocaleString("en-IN")}</td><td><span className={`badge ${STATUS_CLASS[course.status]}`}>{course.status}</span></td><td className="table-actions"><Link to={`/super-admin/courses/${course.id}`}>View & assign</Link></td></tr>)}</tbody></table>}</div>;
}
