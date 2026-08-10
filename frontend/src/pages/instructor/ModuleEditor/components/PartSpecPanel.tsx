import { useEffect, useState } from "react";
import type { ExamModulePart } from "@/api/types";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";

interface PartSpecPanelProps {
  part: ExamModulePart;
  isEditable: boolean;
  busy: boolean;
  onToggleAiEvaluation: (enabled: boolean) => void;
  onUpdateInstructions: (instructions: string) => void;
  questionEntryMode?: "manual" | "bulk";
  onEntryModeChange?: (mode: "manual" | "bulk") => void;
}

export function PartSpecPanel({
  part,
  isEditable,
  busy,
  onToggleAiEvaluation,
  onUpdateInstructions,
  questionEntryMode,
  onEntryModeChange,
}: PartSpecPanelProps) {
  const t = strings.partSpec;
  const canUseAiEvaluation = !part.auto_marked && ["writing", "speaking"].includes(part.section_type);
  const isReading1a = part.part_code === "reading_1a";
  const [isEditingInstructions, setIsEditingInstructions] = useState(false);
  const [instructionsDraft, setInstructionsDraft] = useState(part.instructions ?? "");

  useEffect(() => {
    setInstructionsDraft(part.instructions ?? "");
    setIsEditingInstructions(false);
  }, [part.id, part.instructions]);

  function saveInstructions() {
    onUpdateInstructions(instructionsDraft);
    setIsEditingInstructions(false);
  }

  return (
    <div className="vh-unified-part-header-bar">
      <div className="vh-unified-part-left">
        <h3 className="vh-unified-part-title">{part.title}</h3>
        <span className="count-chip">{t.questionsCount(part.questions.length, part.question_limit)}</span>
        {canUseAiEvaluation && (
          <div className="vh-slim-ai-toggle-group">
            <span className="vh-slim-ai-label">{t.aiEvaluation}:</span>
            <label className="part-ai-toggle">
              <input
                type="checkbox"
                checked={part.ai_evaluation_enabled}
                disabled={!isEditable || busy}
                onChange={(event) => onToggleAiEvaluation(event.currentTarget.checked)}
              />
              <span />
            </label>
          </div>
        )}
      </div>

      {isEditable && onEntryModeChange && questionEntryMode && (
        <div className="vh-method-tabs">
          <button
            type="button"
            className={`vh-method-tab ${questionEntryMode === "manual" ? "is-active" : ""}`}
            onClick={() => onEntryModeChange("manual")}
          >
            Single Question Entry
          </button>
          <button
            type="button"
            className={`vh-method-tab ${questionEntryMode === "bulk" ? "is-active" : ""}`}
            onClick={() => onEntryModeChange("bulk")}
          >
            Bulk Import (PDF / CSV)
          </button>
        </div>
      )}

      {isReading1a && (
      <div className="vh-part-instructions-row">
        {isEditingInstructions ? (
          <div className="vh-part-instructions-editor">
            <textarea
              rows={2}
              value={instructionsDraft}
              onChange={(event) => setInstructionsDraft(event.target.value)}
              placeholder={t.instructionsPlaceholder}
            />
            <div className="vh-part-instructions-actions">
              <button type="button" disabled={busy} onClick={saveInstructions}>
                {t.instructionsSave}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setInstructionsDraft(part.instructions ?? "");
                  setIsEditingInstructions(false);
                }}
              >
                {t.instructionsCancel}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="vh-part-instructions-preview">
              {part.instructions || t.instructionsEmpty}
            </p>
            {isEditable && (
              <button type="button" className="secondary-button" onClick={() => setIsEditingInstructions(true)}>
                {t.instructionsEdit}
              </button>
            )}
          </>
        )}
      </div>
      )}
    </div>
  );
}
