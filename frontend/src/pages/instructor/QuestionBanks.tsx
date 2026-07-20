import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../api/client";
import type { Course, QuestionBank } from "../../api/types";

const SECTION_LABELS: Record<string, string> = {
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  speaking: "Speaking",
};

export function QuestionBanks() {
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("");
  const [courseId, setCourseId] = useState("");
  const [mine, setMine] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { data } = await apiClient.get<QuestionBank[]>("/instructor/authoring/question-banks", {
        params: { search: search || undefined, section: section || undefined, course_id: courseId || undefined, mine },
      });
      setBanks(data);
      setError(null);
    } catch {
      setError("Failed to load question banks.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    apiClient.get<Course[]>("/instructor/courses").then(({ data }) => setCourses(data)).catch(() => undefined);
  }, []);
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [section, courseId, mine]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    load();
  }

  return <div>
    <div className="page-header">
      <div><h1>Question Banks</h1><p className="page-subtitle">Create questions one at a time or extract them from PDF and CSV files.</p></div>
      <Link className="button-link" to="/instructor/question-banks/new">+ New Question Bank</Link>
    </div>
    <form className="filter-bar responsive-filters" onSubmit={submitSearch}>
      <input placeholder="Search question banks..." aria-label="Search question banks" value={search} onChange={(event) => setSearch(event.target.value)} />
      <select aria-label="IELTS section" value={section} onChange={(event) => setSection(event.target.value)}>
        <option value="">All sections</option>
        {Object.entries(SECTION_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
      </select>
      <select aria-label="Course" value={courseId} onChange={(event) => setCourseId(event.target.value)}>
        <option value="">All courses</option>
        {courses.map((course) => <option value={course.id} key={course.id}>{course.title}</option>)}
      </select>
      <label className="inline-check"><input type="checkbox" checked={mine} onChange={(event) => setMine(event.target.checked)} /> My banks</label>
      <button type="submit">Search</button>
    </form>
    {error && <p className="error-text">{error}</p>}
    {loading ? <p>Loading...</p> : banks.length === 0 ? <div className="empty-state"><h2>No question banks found</h2><p>Create a bank for a course, then add individual questions or import a file.</p><Link className="button-link" to="/instructor/question-banks/new">Create Question Bank</Link></div> : <div className="bank-grid">
      {banks.map((bank) => <Link className="bank-card" to={`/instructor/question-banks/${bank.id}`} key={bank.id}>
        <div className="bank-card-top"><span className={`section-chip section-${bank.section}`}>{SECTION_LABELS[bank.section]}</span><strong>{bank.question_count}</strong></div>
        <h2>{bank.title}</h2>
        <p>{bank.description || "No description added."}</p>
        <div className="bank-card-footer"><span>{bank.course_title}</span><span>By {bank.created_by_name}</span></div>
      </Link>)}
    </div>}
  </div>;
}
