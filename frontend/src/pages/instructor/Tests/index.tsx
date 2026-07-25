import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "@/api/client";
import type { Assessment, Course } from "@/api/types";
import { testsStrings as strings } from "./Tests.strings";
import { TestFilterBar } from "./components/TestFilterBar";
import { TestGrid } from "./components/TestGrid";

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
      const { data } = await apiClient.get<Assessment[]>("/instructor/authoring/tests", {
        params: { search: search || undefined, course_id: courseId || undefined, status: status || undefined, mine },
      });
      setTests(data);
      setError(null);
    } catch {
      setError(strings.errors.load);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    apiClient.get<Course[]>("/instructor/courses").then(({ data }) => setCourses(data)).catch(() => undefined);
  }, []);
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [courseId, status, mine]);

  function submit(event: FormEvent) {
    event.preventDefault();
    load();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{strings.title}</h1>
          <p className="page-subtitle">{strings.subtitle}</p>
        </div>
        <Link className="button-link" to="/super-admin/instructor/tests/new">
          {strings.newTest}
        </Link>
      </div>
      <TestFilterBar
        search={search}
        onSearchChange={setSearch}
        courseId={courseId}
        onCourseIdChange={setCourseId}
        courses={courses}
        status={status}
        onStatusChange={setStatus}
        mine={mine}
        onMineChange={setMine}
        onSubmit={submit}
      />
      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p>{strings.loading}</p>
      ) : !tests.length ? (
        <div className="empty-state">
          <h2>{strings.empty.title}</h2>
          <p>{strings.empty.description}</p>
          <Link className="button-link" to="/super-admin/instructor/tests/new">
            {strings.empty.cta}
          </Link>
        </div>
      ) : (
        <TestGrid tests={tests} />
      )}
    </div>
  );
}
