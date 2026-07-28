import { type FormEvent, useEffect, useMemo, useState } from "react";
import { apiClient } from "@/api/client";
import { LinkButton, SearchableSelect } from "@/components/ui";
import type { Course } from "@/api/types";
import { courseCatalogStrings as strings } from "./CourseCatalog.strings";

export function CourseCatalog() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    setLoading(true);
    try {
      const { data } = await apiClient.get<Course[]>("/super-admin/courses", { params: { search: search || undefined, status: status || undefined } });
      setCourses(data);
      setError(null);
    } catch {
      setError(strings.loadError);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status]);
  function submit(event: FormEvent) { event.preventDefault(); load(); }
  const instructors = useMemo(
    () =>
      Object.values(
        courses.reduce<Record<string, { id: number; name: string; email: string; courses: Course[] }>>((tree, course) => {
          const key = String(course.created_by_id);
          tree[key] ||= { id: course.created_by_id, name: course.created_by_name, email: course.created_by_email, courses: [] };
          tree[key].courses.push(course);
          return tree;
        }, {})
      ),
    [courses]
  );

  const f = strings.facts;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{strings.title}</h1>
          <p className="page-subtitle">{strings.subtitle}</p>
        </div>
      </div>
      <form className="filter-bar" onSubmit={submit}>
        <input placeholder={strings.searchPlaceholder} value={search} onChange={(event) => setSearch(event.target.value)} />
        <SearchableSelect
          options={[
            { value: "", label: strings.statusOptions.allStatuses },
            { value: "draft", label: strings.statusOptions.draft },
            { value: "published", label: strings.statusOptions.published },
            { value: "archived", label: strings.statusOptions.archived },
          ]}
          value={status}
          onChange={(value) => setStatus(String(value))}
          searchable={false}
          className="status-filter-select"
        />
        <button>{strings.search}</button>
      </form>
      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p>{strings.loading}</p>
      ) : !instructors.length ? (
        <div className="empty-state">
          <h2>{strings.empty}</h2>
        </div>
      ) : (
        <div className="course-tree">
          {instructors.map((instructor) => (
            <details open key={instructor.id}>
              <summary>
                <span className="tree-node-mark">I</span>
                <span>
                  <strong>{instructor.name}</strong>
                  <small>
                    {instructor.email} · {strings.coursesSuffix(instructor.courses.length)}
                  </small>
                </span>
              </summary>
              <div className="course-tree-children">
                {instructor.courses.map((course) => (
                  <article key={course.id}>
                    <div className="tree-course-head">
                      <div>
                        <span className={`badge ${course.status === "published" ? "badge-green" : course.status === "draft" ? "badge-amber" : "badge-gray"}`}>
                          {course.status}
                        </span>
                        {!course.is_visible && <span className="badge badge-gray">hidden</span>}
                        <h2>{course.title}</h2>
                        <p>{course.summary || strings.noSummary}</p>
                      </div>
                      <LinkButton to={`/super-admin/courses/${course.id}`}>
                        {strings.manage}
                      </LinkButton>
                    </div>
                    <dl className="tree-course-facts">
                      <div>
                        <dt>{f.created}</dt>
                        <dd>{new Date(course.created_at).toLocaleString()}</dd>
                      </div>
                      <div>
                        <dt>{f.published}</dt>
                        <dd>{course.published_at ? new Date(course.published_at).toLocaleString() : f.notPublished}</dd>
                      </div>
                      <div>
                        <dt>{f.modules}</dt>
                        <dd>{course.modules.length}</dd>
                      </div>
                      <div>
                        <dt>{f.institutes}</dt>
                        <dd>{course.assignment_count}</dd>
                      </div>
                      <div>
                        <dt>{f.resources}</dt>
                        <dd>{course.asset_count}</dd>
                      </div>
                      <div>
                        <dt>{f.updated}</dt>
                        <dd>{course.updated_at ? new Date(course.updated_at).toLocaleString() : f.noChanges}</dd>
                      </div>
                    </dl>
                    {course.modules.length > 0 && (
                      <ol className="tree-module-list">
                        {course.modules.map((module) => (
                          <li key={module.id}>
                            <span>{module.title}</span>
                            <small>
                              {module.module_type.replaceAll("_", " ")} · {module.duration_minutes} min
                            </small>
                          </li>
                        ))}
                      </ol>
                    )}
                  </article>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
