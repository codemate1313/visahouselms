import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../api/client";
import type { Assessment, Course } from "../../api/types";

const TYPE_LABELS: Record<string, string> = { practice: "Practice", module_mock: "Module mock", full_mock: "Full mock", final: "Final test" };
const STATUS_CLASS: Record<string, string> = { draft: "badge-amber", published: "badge-green", archived: "badge-gray" };

export function Tests() {
  const [tests, setTests] = useState<Assessment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState("");
  const [courseId, setCourseId] = useState("");
  const [status, setStatus] = useState("");
  const [mine, setMine] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { data } = await apiClient.get<Assessment[]>("/instructor/authoring/tests", { params: { search: search || undefined, course_id: courseId || undefined, status: status || undefined, mine } });
      setTests(data); setError(null);
    } catch { setError("Failed to load tests."); }
    finally { setLoading(false); }
  }
  useEffect(() => { apiClient.get<Course[]>("/instructor/courses").then(({ data }) => setCourses(data)).catch(() => undefined); }, []);
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [courseId, status, mine]);
  function submit(event: FormEvent) { event.preventDefault(); load(); }

  return <div>
    <div className="page-header"><div><h1>Test Builder</h1><p className="page-subtitle">Assemble course question banks into timed IELTS assessments.</p></div><Link className="button-link" to="/super-admin/instructor/tests/new">+ New Test</Link></div>
    <form className="filter-bar responsive-filters" onSubmit={submit}><input placeholder="Search tests..." value={search} onChange={(event) => setSearch(event.target.value)} /><select value={courseId} onChange={(event) => setCourseId(event.target.value)}><option value="">All courses</option>{courses.map((course) => <option value={course.id} key={course.id}>{course.title}</option>)}</select><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select><label className="inline-check"><input type="checkbox" checked={mine} onChange={(event) => setMine(event.target.checked)} /> My tests</label><button type="submit">Search</button></form>
    {error && <p className="error-text">{error}</p>}
    {loading ? <p>Loading...</p> : !tests.length ? <div className="empty-state"><h2>No tests found</h2><p>Create a test and add questions from one of its course banks.</p><Link className="button-link" to="/super-admin/instructor/tests/new">Create Test</Link></div> : <div className="test-card-grid">{tests.map((test) => <Link className="test-card" to={`/super-admin/instructor/tests/${test.id}`} key={test.id}><div className="test-card-head"><span className={`badge ${STATUS_CLASS[test.status]}`}>{test.status}</span><span>{TYPE_LABELS[test.assessment_type]}</span></div><h2>{test.title}</h2><p>{test.description || "No description added."}</p><dl><div><dt>Questions</dt><dd>{test.question_count}</dd></div><div><dt>Points</dt><dd>{test.total_points}</dd></div><div><dt>Time</dt><dd>{test.duration_minutes ? `${test.duration_minutes} min` : "Untimed"}</dd></div></dl><small>{test.course_title} · By {test.created_by_name}</small></Link>)}</div>}
  </div>;
}
