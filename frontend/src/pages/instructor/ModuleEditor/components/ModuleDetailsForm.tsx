import type { FormEvent } from "react";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { Button } from "@/components/ui";
import type { ExamModule } from "@/api/types";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";

interface ModuleDetailsFormProps {
  module: ExamModule;
  details: { title: string; description: string; instructions: string };
  onDetailsChange: (details: { title: string; description: string; instructions: string }) => void;
  isEditable: boolean;
  busy: boolean;
  onSubmit: (event: FormEvent) => void;
  onDelete: () => void;
}

export function ModuleDetailsForm({ module, details, onDetailsChange, isEditable, busy, onSubmit, onDelete }: ModuleDetailsFormProps) {
  const t = strings.details;
  return (
    <form className="form-card wide module-details collapsible-form-card" onSubmit={onSubmit}>
      <CollapsiblePanel
        className="form-card-collapsible"
        title={t.heading}
        description={t.description}
        badge={<span className="count-chip">{module.duration_minutes} min</span>}
      >
        <label htmlFor="module-title">{t.titleLabel}</label>
        <input
          id="module-title"
          value={details.title}
          onChange={(event) => onDetailsChange({ ...details, title: event.target.value })}
          required
          readOnly={!isEditable}
        />
        <label htmlFor="module-description">{t.descriptionLabel}</label>
        <textarea
          id="module-description"
          rows={3}
          value={details.description}
          onChange={(event) => onDetailsChange({ ...details, description: event.target.value })}
          readOnly={!isEditable}
        />
        <label htmlFor="module-instructions">{t.instructionsLabel}</label>
        <textarea
          id="module-instructions"
          rows={3}
          value={details.instructions}
          onChange={(event) => onDetailsChange({ ...details, instructions: event.target.value })}
          readOnly={!isEditable}
        />
        <div className="form-actions">
          {isEditable && (
            <Button type="submit" disabled={busy}>
              {t.save}
            </Button>
          )}
          {module.status === "draft" && (
            <Button type="button" variant="text" className="danger-text" onClick={onDelete} disabled={busy}>
              {busy ? t.working : t.deleteDraft}
            </Button>
          )}
        </div>
      </CollapsiblePanel>
    </form>
  );
}
