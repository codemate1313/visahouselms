import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../api/client";
import { SearchableSelect } from "../../components/SearchableSelect";
import type { Course } from "../../api/types";

export function CourseCatalog() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  async function load() { setLoading(true); try { const { data } = await apiClient.get<Course[]>("/super-admin/courses", { params: { search: search || undefined, status: status || undefined } }); setCourses(data); setError(null); } catch { setError("Failed to load course hierarchy."); } finally { setLoading(false); } }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status]);
  function submit(event: FormEvent) { event.preventDefault(); load(); }
  const instructors = useMemo(() => Object.values(courses.reduce<Record<string, { id: number; name: string; email: string; courses: Course[] }>>((tree, course) => { const key = String(course.created_by_id); tree[key] ||= { id: course.created_by_id, name: course.created_by_name, email: course.created_by_email, courses: [] }; tree[key].courses.push(course); return tree; }, {})), [courses]);

  return <div><div className="page-header"><div><h1>Instructor Course Hierarchy</h1><p className="page-subtitle">Inspect every SA Instructor, their courses, contents, publication dates, and distribution.</p></div></div>
    <form className="filter-bar" onSubmit={submit}><input placeholder="Search course title..." value={search} onChange={(event) => setSearch(event.target.value)} /><SearchableSelect options={[{ value: "", label: "All statuses" }, { value: "draft", label: "Draft" }, { value: "published", label: "Published" }, { value: "archived", label: "Archived" }]} value={status} onChange={(value) => setStatus(String(value))} searchable={false} className="status-filter-select" /><button>Search</button></form>
    {error && <p className="error-text">{error}</p>}
    {loading ? <p>Loading...</p> : !instructors.length ? <div className="empty-state"><h2>No courses found</h2></div> : <div className="course-tree">{instructors.map((instructor) => <details open key={instructor.id}><summary><span className="tree-node-mark">I</span><span><strong>{instructor.name}</strong><small>{instructor.email} · {instructor.courses.length} course{instructor.courses.length === 1 ? "" : "s"}</small></span></summary><div className="course-tree-children">{instructor.courses.map((course) => <article key={course.id}><div className="tree-course-head"><div><span className={`badge ${course.status === "published" ? "badge-green" : course.status === "draft" ? "badge-amber" : "badge-gray"}`}>{course.status}</span>{!course.is_visible && <span className="badge badge-gray">hidden</span>}<h2>{course.title}</h2><p>{course.summary || "No summary"}</p></div><Link className="button-link" to={`/super-admin/courses/${course.id}`}>Manage</Link></div><dl className="tree-course-facts"><div><dt>Created</dt><dd>{new Date(course.created_at).toLocaleString()}</dd></div><div><dt>Published</dt><dd>{course.published_at ? new Date(course.published_at).toLocaleString() : "Not published"}</dd></div><div><dt>Modules</dt><dd>{course.modules.length}</dd></div><div><dt>Institutes</dt><dd>{course.assignment_count}</dd></div><div><dt>Resources</dt><dd>{course.asset_count}</dd></div><div><dt>Updated</dt><dd>{course.updated_at ? new Date(course.updated_at).toLocaleString() : "No changes"}</dd></div></dl>{course.modules.length > 0 && <ol className="tree-module-list">{course.modules.map((module) => <li key={module.id}><span>{module.title}</span><small>{module.module_type.replaceAll("_", " ")} · {module.duration_minutes} min</small></li>)}</ol>}</article>)}</div></details>)}</div>}
  </div>;
}
