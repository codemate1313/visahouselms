import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../api/client";
import { SearchableSelect } from "../../components/SearchableSelect";
import type { ExamModule } from "../../api/types";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "No changes";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getModuleTypeBadge(typeStr: string) {
  const lower = typeStr.toLowerCase();
  if (lower.includes("listening")) return "Listening";
  if (lower.includes("reading")) return "Reading";
  if (lower.includes("writing")) return "Writing";
  if (lower.includes("speaking")) return "Speaking";
  if (lower.includes("full") || lower.includes("mock")) return "Full Mock";
  if (lower.includes("final")) return "Final Test";
  return typeStr;
}

export function ModuleControl() {
  const [modules, setModules] = useState<ExamModule[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const { data } = await apiClient.get<ExamModule[]>("/super-admin/modules", {
        params: { search: search || undefined, status: status || undefined },
      });
      setModules(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [status]);

  function submit(event: FormEvent) {
    event.preventDefault();
    load();
  }

  const instructors = useMemo(() => {
    return Object.values(
      modules.reduce<Record<string, { id: number; name: string; modules: ExamModule[] }>>(
        (tree, module) => {
          const key = String(module.created_by_id);
          tree[key] ||= {
            id: module.created_by_id,
            name: module.created_by_name,
            modules: [],
          };
          tree[key].modules.push(module);
          return tree;
        },
        {}
      )
    );
  }, [modules]);

  return (
    <div className="module-control-page">
      <div className="page-header">
        <div>
          <span className="page-eyebrow">Course Management</span>
          <h1>Course Control</h1>
          <p className="page-subtitle">Every course grouped under the SA Instructor who created it.</p>
        </div>
      </div>

      <form className="filter-bar course-filter-bar" onSubmit={submit}>
        <div className="search-input-wrapper">
          <input
            placeholder="Search courses by title or keyword..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <SearchableSelect
          options={STATUS_OPTIONS}
          value={status}
          onChange={(val) => setStatus(String(val))}
          placeholder="All statuses"
          searchable={false}
          className="status-filter-select"
        />
        <button type="submit" className="filter-search-btn">
          Search
        </button>
      </form>

      {loading ? (
        <div className="course-loading-state">Loading courses...</div>
      ) : !instructors.length ? (
        <div className="empty-state">
          <h2>No courses found</h2>
          <p>Try clearing your search filters or check back later.</p>
        </div>
      ) : (
        <div className="course-tree">
          {instructors.map((instructor) => (
            <details open key={instructor.id} className="instructor-tree-group">
              <summary className="instructor-summary-bar">
                <div className="instructor-avatar-pill">
                  {instructor.name.charAt(0).toUpperCase()}
                </div>
                <div className="instructor-info-title">
                  <strong>{instructor.name}</strong>
                  <span className="instructor-courses-badge">
                    {instructor.modules.length} course{instructor.modules.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="instructor-chevron-toggle">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="summary-chevron-icon"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </summary>

              <div className="course-tree-children">
                {instructor.modules.map((module) => (
                  <article key={module.id} className="sleek-course-card">
                    <div className="tree-course-head">
                      <div className="course-head-content">
                        <div className="course-status-pills">
                          <span
                            className={`badge ${
                              module.status === "published"
                                ? "badge-green"
                                : module.status === "draft"
                                ? "badge-amber"
                                : "badge-gray"
                            }`}
                          >
                            {module.status.charAt(0).toUpperCase() + module.status.slice(1)}
                          </span>
                          {!module.is_visible && <span className="badge badge-gray">Hidden</span>}
                        </div>

                        <h2 className="course-card-title">{module.title}</h2>
                        <p className="course-card-desc">
                          {module.description || `${module.module_label} course`}
                        </p>
                      </div>

                      <Link className="course-manage-btn" to={`/super-admin/modules/${module.id}`}>
                        Manage
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="5" y1="12" x2="19" y2="12" />
                          <polyline points="12 5 19 12 12 19" />
                        </svg>
                      </Link>
                    </div>

                    <div className="tree-course-facts-grid">
                      <div className="fact-item">
                        <span className="fact-label">Type</span>
                        <span className="fact-value type-pill">{getModuleTypeBadge(module.module_label)}</span>
                      </div>
                      <div className="fact-item">
                        <span className="fact-label">Questions</span>
                        <span className="fact-value highlight-num">{module.question_count}</span>
                      </div>
                      <div className="fact-item">
                        <span className="fact-label">Institutes</span>
                        <span className="fact-value highlight-num">{module.assignment_count}</span>
                      </div>
                      <div className="fact-item">
                        <span className="fact-label">Created</span>
                        <span className="fact-value date-val">{formatDate(module.created_at)}</span>
                      </div>
                      <div className="fact-item">
                        <span className="fact-label">Published</span>
                        <span className="fact-value date-val">
                          {module.published_at ? formatDate(module.published_at) : "Not published"}
                        </span>
                      </div>
                      <div className="fact-item">
                        <span className="fact-label">Updated</span>
                        <span className="fact-value date-val">
                          {module.updated_at ? formatDate(module.updated_at) : "No changes"}
                        </span>
                      </div>
                    </div>
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
