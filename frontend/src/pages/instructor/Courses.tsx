import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../api/client";
import type { Course } from "../../api/types";

const STATUS_CLASS: Record<string, string> = { draft: "badge-amber", published: "badge-green", archived: "badge-gray" };

export function Courses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [mine, setMine] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { data } = await apiClient.get<Course[]>("/instructor/courses", { params: { search: search || undefined, status: statusFilter || undefined, mine } });
      setCourses(data); setError(null);
    } catch { setError("Failed to load courses."); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [statusFilter, mine]);
  function searchCourses(event: FormEvent) { event.preventDefault(); load(); }

  return <div>
    <div className="page-header"><div><h1>Courses</h1><p className="page-subtitle">Create and maintain the central IELTS course catalog.</p></div><Link className="button-link" to="/instructor/courses/new">+ New Course</Link></div>
    <form className="filter-bar" onSubmit={searchCourses}>
      <input placeholder="Search courses..." aria-label="Search courses" value={search} onChange={(e) => setSearch(e.target.value)} />
      <select aria-label="Course status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All statuses</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select>
      <label className="inline-check"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> My courses</label>
      <button type="submit">Search</button>
    </form>
    {error && <p className="error-text">{error}</p>}
    {loading ? <p>Loading...</p> : courses.length === 0 ? <div className="empty-state"><h2>No courses found</h2><p>Create the first course or change your filters.</p></div> : <div className="course-grid">{courses.map((course) => <Link className="course-card" to={`/instructor/courses/${course.id}`} key={course.id}>
      <div className="course-card-top"><span className={`badge ${STATUS_CLASS[course.status]}`}>{course.status}</span>{course.is_featured && <span className="badge featured-badge">Featured</span>}</div>
      <h2>{course.title}</h2><p>{course.summary || "No summary added yet."}</p>
      <div className="course-meta"><span>{course.asset_count} resources</span><span>{course.assignment_count} institutes</span><span>{course.currency} {Number(course.price).toLocaleString("en-IN")}</span></div>
      <small>By {course.created_by_name}</small>
    </Link>)}</div>}
  </div>;
}
