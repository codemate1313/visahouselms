import { Link } from "react-router-dom";
import type { ExamModule } from "@/api/types";
import { modulesStrings as strings } from "../Modules.strings";
import { Badge, Button } from "@/components/ui";

interface ModuleListProps {
  modules: ExamModule[];
  onDeleteDraft: (moduleId: number, title: string) => void;
}

export function ModuleList({ modules, onDeleteDraft }: ModuleListProps) {
  return (
    <div className="module-list-grid">
      {modules.map((module) => {
        const href = `/super-admin/instructor/modules/${module.id}`;
        const isDraft = module.status === "draft";
        // A draft's primary action depends on how far along it is: finish the
        // setup, or go and publish it. Published/archived modules only edit.
        const primaryLabel = !isDraft
          ? strings.editModule
          : module.ready_to_publish
          ? strings.reviewAndPublish
          : strings.continueSetup;

        return (
          <article className="module-record-card" key={module.id}>
            <Link className="module-record-main" to={href}>
              <div className="module-record-top">
                <span className={`section-chip section-${module.module_type}`}>{module.module_label}</span>
                <Badge tone={module.status === "published" ? "green" : module.status === "archived" ? "gray" : "amber"}>
                  {module.status}
                </Badge>
              </div>
              <h2>{module.title}</h2>
              <p>{module.description || strings.typeDetail[module.module_type]}</p>
              <div className="module-record-metrics">
                <span><strong>{module.part_count}</strong> {strings.partsLabel}</span>
                <span><strong>{module.question_count}</strong> {strings.questionsLabel}</span>
                <span><strong>{module.duration_minutes}</strong> {strings.minutesLabel}</span>
              </div>
            </Link>

            {/* Readiness is information, not an action - it used to sit where
                the button belongs, which is why "Edit" read as a status label. */}
            {isDraft && (
              <p className={`module-record-status ${module.ready_to_publish ? "is-ready" : "needs-work"}`}>
                {module.ready_to_publish
                  ? strings.readyToPublish
                  : strings.requirementsRemaining(module.validation_errors.length)}
              </p>
            )}

            <div className="module-record-actions">
              <Link to={href} className="ui-btn ui-btn-secondary ui-btn-sm module-record-primary-action">
                <span className="ui-btn-label">{primaryLabel}</span>
              </Link>
              {isDraft && (
                <Button
                  variant="text"
                  size="sm"
                  className="module-record-delete"
                  onClick={() => onDeleteDraft(module.id, module.title)}
                >
                  {strings.deleteDraftShort}
                </Button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
