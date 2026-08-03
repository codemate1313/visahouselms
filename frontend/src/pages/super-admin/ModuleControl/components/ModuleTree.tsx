import { Icon } from "@/components/icons";
import { LinkButton } from "@/components/ui";
import type { ExamModule } from "@/api/types";
import { moduleControlStrings as strings } from "../ModuleControl.strings";
import { formatDate, getModuleTypeBadge } from "../helpers";

interface InstructorGroup {
  id: number;
  name: string;
  modules: ExamModule[];
}

interface ModuleTreeProps {
  instructors: InstructorGroup[];
}

export function ModuleTree({ instructors }: ModuleTreeProps) {
  const f = strings.facts;
  return (
    <div className="course-tree">
      {instructors.map((instructor) => (
        <details open key={instructor.id} className="instructor-tree-group">
          <summary className="instructor-summary-bar">
            <div className="instructor-avatar-pill">{instructor.name.charAt(0).toUpperCase()}</div>
            <div className="instructor-info-title">
              <strong>{instructor.name}</strong>
              <span className="instructor-courses-badge">{strings.coursesSuffix(instructor.modules.length)}</span>
            </div>
            <div className="instructor-chevron-toggle">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="summary-chevron-icon">
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
                      <span className={`badge ${module.status === "published" ? "badge-green" : module.status === "draft" ? "badge-amber" : "badge-gray"}`}>
                        {module.status.charAt(0).toUpperCase() + module.status.slice(1)}
                      </span>
                      {!module.is_visible && <span className="badge badge-gray">{strings.hidden}</span>}
                    </div>

                    <h2 className="course-card-title">{module.title}</h2>
                    <p className="course-card-desc">{module.description || strings.noDescriptionSuffix(module.module_label)}</p>
                  </div>

                  <LinkButton className="course-manage-btn" to={`/super-admin/modules/${module.id}`} size="md" rightIcon={<Icon name="arrowRight" />}>
                    {strings.manage}
                  </LinkButton>
                </div>

                <div className="tree-course-facts-grid">
                  <div className="fact-item">
                    <span className="fact-label">{f.type}</span>
                    <span className="fact-value type-pill">{getModuleTypeBadge(module.module_label)}</span>
                  </div>
                  <div className="fact-item">
                    <span className="fact-label">{f.questions}</span>
                    <span className="fact-value highlight-num">{module.question_count}</span>
                  </div>
                  <div className="fact-item">
                    <span className="fact-label">{f.institutes}</span>
                    <span className="fact-value highlight-num">{module.assignment_count}</span>
                  </div>
                  <div className="fact-item">
                    <span className="fact-label">{f.created}</span>
                    <span className="fact-value date-val">{formatDate(module.created_at)}</span>
                  </div>
                  <div className="fact-item">
                    <span className="fact-label">{f.published}</span>
                    <span className="fact-value date-val">{module.published_at ? formatDate(module.published_at) : f.notPublished}</span>
                  </div>
                  <div className="fact-item">
                    <span className="fact-label">{f.updated}</span>
                    <span className="fact-value date-val">{module.updated_at ? formatDate(module.updated_at) : f.noChanges}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
