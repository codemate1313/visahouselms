import { Icon } from "@/components/icons";
import type { ExamModule, ExamModulePart } from "@/api/types";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";

interface ModuleReadinessPanelProps {
  module: ExamModule;
  busy: boolean;
  onChangeStatus: (status: "draft" | "published" | "archived") => void;
  onChoosePart?: (part: ExamModulePart) => void;
}

interface ParsedError {
  raw: string;
  tag: string;
  body: string;
}

function parseValidationError(errorStr: string): ParsedError {
  // Regex to separate tag (e.g. "Listening 1", "Speaking 2") from the requirement body
  const match = errorStr.match(/^([A-Za-z0-9\s]+?)\s+(requires|draws|needs|has)(.+)$/i);
  if (match) {
    const tag = match[1].trim();
    const rest = (match[2] + match[3]).trim().replace(/\.$/, "");
    return { raw: errorStr, tag, body: rest };
  }
  return { raw: errorStr, tag: "Requirement", body: errorStr };
}

export function ModuleReadinessPanel({ module, busy, onChangeStatus, onChoosePart }: ModuleReadinessPanelProps) {
  const t = strings.readiness;
  const isReady = module.ready_to_publish;
  const errors = module.validation_errors || [];
  const parsedErrors = errors.map(parseValidationError);

  function handleCardClick(item: ParsedError) {
    const numMatch = item.tag.match(/\d+/);
    const partNum = numMatch ? Number(numMatch[0]) : null;

    // Search for matching part in module.parts
    const matchedPart = module.parts?.find(
      (p) =>
        p.title?.toLowerCase() === item.tag.toLowerCase() ||
        (partNum !== null && p.part_code?.endsWith(`_${partNum}`))
    );

    if (matchedPart && onChoosePart) {
      onChoosePart(matchedPart);
    } else {
      // Scroll to module details or top of authoring layout
      const detailsEl = document.querySelector(".module-details") || document.querySelector(".module-authoring-layout");
      if (detailsEl) {
        detailsEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  return (
    <div className={`vh-readiness-studio-card ${isReady ? "is-ready-card" : "needs-work-card"}`}>
      {/* Header Banner */}
      <div className="vh-readiness-header">
        <div className="vh-readiness-title-group">
          <div className="vh-readiness-badge-row">
            <span className={`vh-readiness-status-badge ${isReady ? "is-ready" : "needs-work"}`}>
              <span className="vh-status-dot" />
              {isReady ? t.ready : t.needsWork}
            </span>
            <span className="vh-readiness-count-chip">
              {isReady ? "100% Validated" : `${errors.length} Action Items Pending`}
            </span>
          </div>

          <h2 className="vh-readiness-heading">
            {isReady ? t.readyTitle : t.notReadyTitle}
          </h2>
          <p className="vh-readiness-description">
            {isReady ? t.readyDescription : t.notReadyDescription}
          </p>
        </div>

        {/* Action Button Group */}
        <div className="vh-readiness-actions">
          {module.status === "draft" && (
            <button
              type="button"
              className={`vh-publish-btn ${isReady ? "is-active" : "is-disabled"}`}
              onClick={() => isReady && onChangeStatus("published")}
              disabled={busy || !isReady}
            >
              <span>{t.publish}</span>
              <Icon name="arrowRight" />
            </button>
          )}

          {module.status === "published" && (
            <div className="vh-actions-dual">
              <button
                type="button"
                className="vh-btn-secondary"
                onClick={() => onChangeStatus("draft")}
                disabled={busy}
              >
                {t.returnToDraft}
              </button>
              <button
                type="button"
                className="vh-btn-danger"
                onClick={() => onChangeStatus("archived")}
                disabled={busy}
              >
                {t.archive}
              </button>
            </div>
          )}

          {module.status === "archived" && (
            <button
              type="button"
              className="vh-btn-secondary"
              onClick={() => onChangeStatus("draft")}
              disabled={busy}
            >
              {t.restoreAsDraft}
            </button>
          )}
        </div>
      </div>

      {/* Validation Checklist Items Grid */}
      {!isReady && errors.length > 0 && (
        <div className="vh-checklist-section">
          <div className="vh-checklist-grid">
            {parsedErrors.map((item, index) => (
              <div
                key={index}
                className="vh-checklist-item-card is-interactive"
                onClick={() => handleCardClick(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleCardClick(item);
                  }
                }}
              >
                <div className="vh-checklist-item-icon">
                  <Icon name="x" />
                </div>
                <div className="vh-checklist-item-content">
                  <div className="vh-checklist-tag-row">
                    <span className="vh-checklist-tag">{item.tag}</span>
                    <span className="vh-checklist-goto-badge">
                      <span>Jump to part</span>
                      <Icon name="arrowRight" />
                    </span>
                  </div>
                  <p className="vh-checklist-text">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
