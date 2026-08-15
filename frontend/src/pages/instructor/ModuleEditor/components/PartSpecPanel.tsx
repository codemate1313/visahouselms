import { useEffect, useState } from "react";
import type { ExamModulePart } from "@/api/types";
import { Icon } from "@/components/icons";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";

interface PartSpecPanelProps {
  part: ExamModulePart;
  isEditable: boolean;
  busy: boolean;
  onToggleAiEvaluation: (enabled: boolean) => void;
  onUpdateInstructions: (instructions: string) => void;
  partTitle: string;
  onPartTitleChange: (title: string) => void;
  onSavePartTitle: () => void;
  questionEntryMode?: "manual" | "bulk";
  onEntryModeChange?: (mode: "manual" | "bulk") => void;
}

export function PartSpecPanel({
  part,
  isEditable,
  busy,
  onToggleAiEvaluation,
  onUpdateInstructions,
  partTitle,
  onPartTitleChange,
  onSavePartTitle,
  questionEntryMode,
  onEntryModeChange,
}: PartSpecPanelProps) {
  const t = strings.partSpec;
  const canUseAiEvaluation = !part.auto_marked && ["writing", "speaking"].includes(part.section_type);
  const isReading1a = part.part_code === "reading_1a";
  const isSpeaking = part.section_type === "speaking";
  const canEditPartInstructions = isReading1a || isSpeaking;
  const instructionsLabel = isSpeaking ? "Sonia segment intro" : t.instructionsLabel;
  const instructionsPlaceholder = isSpeaking
    ? "Example: In this part, I will ask you some questions about yourself. Answer each question clearly."
    : t.instructionsPlaceholder;
  const instructionsEditLabel = isSpeaking ? "Edit intro" : t.instructionsEdit;
  const instructionsSaveLabel = isSpeaking ? "Save intro" : t.instructionsSave;
  const instructionsEmpty = isSpeaking
    ? "No intro set yet — Sonia will start with the first question."
    : t.instructionsEmpty;
  const [isEditingInstructions, setIsEditingInstructions] = useState(false);
  const [instructionsDraft, setInstructionsDraft] = useState(part.instructions ?? "");
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  useEffect(() => {
    setInstructionsDraft(part.instructions ?? "");
    setIsEditingInstructions(false);
  }, [part.id, part.instructions]);

  useEffect(() => {
    setIsEditingTitle(false);
  }, [part.id]);

  function saveInstructions() {
    onUpdateInstructions(instructionsDraft);
    setIsEditingInstructions(false);
  }

  function saveTitle() {
    if (!partTitle.trim() || partTitle === part.title) {
      setIsEditingTitle(false);
      onPartTitleChange(part.title);
      return;
    }
    onSavePartTitle();
    setIsEditingTitle(false);
  }

  function cancelTitle() {
    onPartTitleChange(part.title);
    setIsEditingTitle(false);
  }

  return (
    <div className="vh-unified-part-header-bar">
      <div className="vh-unified-part-left">
        {isEditingTitle ? (
          <div className="vh-part-title-edit">
            <input
              type="text"
              className="ui-input"
              value={partTitle}
              autoFocus
              disabled={busy}
              aria-label="Section heading"
              onChange={(event) => onPartTitleChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") { event.preventDefault(); saveTitle(); }
                if (event.key === "Escape") cancelTitle();
              }}
            />
            <button type="button" className="button primary" disabled={busy || !partTitle.trim()} onClick={saveTitle}>
              Save
            </button>
            <button type="button" className="secondary-button" disabled={busy} onClick={cancelTitle}>
              Cancel
            </button>
          </div>
        ) : (
          <>
            <h3 className="vh-unified-part-title" title={part.title}>{part.title}</h3>
            {isEditable && (
              <button
                type="button"
                className="vh-title-edit-btn"
                onClick={() => setIsEditingTitle(true)}
                aria-label="Rename section heading"
                title="Rename section heading"
              >
                <Icon name="edit" />
              </button>
            )}
          </>
        )}
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

      {canEditPartInstructions && (
      <div className="vh-part-instructions-row">
        {isEditingInstructions ? (
          <div className="vh-part-instructions-editor">
            <label htmlFor={`part-instructions-${part.id}`}>{instructionsLabel}</label>
            <textarea
              id={`part-instructions-${part.id}`}
              rows={2}
              value={instructionsDraft}
              onChange={(event) => setInstructionsDraft(event.target.value)}
              placeholder={instructionsPlaceholder}
            />
            <div className="vh-part-instructions-actions">
              <button type="button" disabled={busy} onClick={saveInstructions}>
                {instructionsSaveLabel}
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
            <div className="vh-part-instructions-preview-block">
              <span>{instructionsLabel}</span>
              <p className="vh-part-instructions-preview">
                {part.instructions || instructionsEmpty}
              </p>
            </div>
            {isEditable && (
              <button type="button" className="secondary-button" onClick={() => setIsEditingInstructions(true)}>
                {instructionsEditLabel}
              </button>
            )}
          </>
        )}
      </div>
      )}
    </div>
  );
}
