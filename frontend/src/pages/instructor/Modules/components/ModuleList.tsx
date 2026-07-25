import { Link } from "react-router-dom";
import type { ExamModule } from "@/api/types";
import { modulesStrings as strings } from "../Modules.strings";

interface ModuleListProps {
  modules: ExamModule[];
  onDeleteDraft: (moduleId: number, title: string) => void;
}

export function ModuleList({ modules, onDeleteDraft }: ModuleListProps) {
  return (
    <div className="module-list-grid">
      {modules.map((module) => (
        <article className="module-record-card" key={module.id}>
          <Link className="module-record-main" to={`/super-admin/instructor/modules/${module.id}`}>
            <div className="module-record-top">
              <span className={`section-chip section-${module.module_type}`}>{module.module_label}</span>
              <span className={`badge ${module.status === "published" ? "badge-green" : module.status === "archived" ? "badge-gray" : "badge-amber"}`}>
                {module.status}
              </span>
            </div>
            <h2>{module.title}</h2>
            <p>{module.description || strings.typeDetail[module.module_type]}</p>
            <div className="module-record-metrics">
              <span><strong>{module.part_count}</strong> {strings.partsLabel}</span>
              <span><strong>{module.question_count}</strong> {strings.questionsLabel}</span>
              <span><strong>{module.duration_minutes}</strong> {strings.minutesLabel}</span>
            </div>
            <small className={module.ready_to_publish ? "ready-label" : "needs-work-label"}>
              {module.ready_to_publish ? strings.readyToPublish : strings.requirementsRemaining(module.validation_errors.length)}
            </small>
          </Link>
          {module.status === "draft" && (
            <button type="button" className="danger-text module-draft-delete" onClick={() => onDeleteDraft(module.id, module.title)}>
              {strings.deleteDraft}
            </button>
          )}
        </article>
      ))}
    </div>
  );
}
