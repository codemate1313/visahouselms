import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { Button } from "@/components/ui";
import type { ExamModule } from "@/api/types";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";

interface ModuleReadinessPanelProps {
  module: ExamModule;
  busy: boolean;
  onChangeStatus: (status: "draft" | "published" | "archived") => void;
}

export function ModuleReadinessPanel({ module, busy, onChangeStatus }: ModuleReadinessPanelProps) {
  const t = strings.readiness;
  return (
    <CollapsiblePanel
      className={`module-readiness ${module.ready_to_publish ? "is-ready" : "needs-work"}`}
      title={module.ready_to_publish ? t.readyTitle : t.notReadyTitle}
      description={module.ready_to_publish ? t.readyDescription : t.notReadyDescription}
      badge={<span className={`badge ${module.ready_to_publish ? "badge-green" : "badge-amber"}`}>{module.ready_to_publish ? t.ready : t.needsWork}</span>}
    >
      {!module.ready_to_publish && (
        <ul className="module-readiness-list">
          {module.validation_errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
      <div className="module-status-actions">
        {module.status === "draft" && (
          <Button onClick={() => onChangeStatus("published")} disabled={busy || !module.ready_to_publish}>
            {t.publish}
          </Button>
        )}
        {module.status === "published" && (
          <>
            <Button variant="secondary" onClick={() => onChangeStatus("draft")} disabled={busy}>
              {t.returnToDraft}
            </Button>
            <Button onClick={() => onChangeStatus("archived")} disabled={busy}>
              {t.archive}
            </Button>
          </>
        )}
        {module.status === "archived" && (
          <Button onClick={() => onChangeStatus("draft")} disabled={busy}>
            {t.restoreAsDraft}
          </Button>
        )}
      </div>
    </CollapsiblePanel>
  );
}
