import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "@/api/client";
import type { Course, QuestionBank } from "@/api/types";
import { questionBanksStrings as strings } from "./QuestionBanks.strings";
import { QuestionBankFilterBar } from "./components/QuestionBankFilterBar";
import { QuestionBankGrid } from "./components/QuestionBankGrid";

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
      setError(strings.errors.load);
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{strings.title}</h1>
          <p className="page-subtitle">{strings.subtitle}</p>
        </div>
        <Link className="button-link" to="/super-admin/instructor/question-banks/new">
          {strings.newBank}
        </Link>
      </div>
      <QuestionBankFilterBar
        search={search}
        onSearchChange={setSearch}
        section={section}
        onSectionChange={setSection}
        courseId={courseId}
        onCourseIdChange={setCourseId}
        courses={courses}
        mine={mine}
        onMineChange={setMine}
        onSubmit={submitSearch}
      />
      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p>{strings.loading}</p>
      ) : banks.length === 0 ? (
        <div className="empty-state">
          <h2>{strings.empty.title}</h2>
          <p>{strings.empty.description}</p>
          <Link className="button-link" to="/super-admin/instructor/question-banks/new">
            {strings.empty.cta}
          </Link>
        </div>
      ) : (
        <QuestionBankGrid banks={banks} />
      )}
    </div>
  );
}
