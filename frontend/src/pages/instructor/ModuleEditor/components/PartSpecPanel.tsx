import { useEffect, useState } from "react";
import type { ExamModulePart } from "@/api/types";
import { Icon } from "@/components/icons";
import { RichTextEditor } from "@/components/ui";
import { Button } from "@/components/ui/Button/Button";
import { IconButton } from "@/components/ui/IconButton/IconButton";
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

const DEFAULT_INSTRUCTIONS: Record<string, string> = {
  reading_1a: "Read each sentence. Choose the word that can best replace the bold word without changing the meaning.",
  reading_1b: "Read the text and choose the correct word for each gap.",
  reading_2: "Read the text. Six sentences have been removed. Choose the sentence that best fits each gap. One sentence is a distractor.",
  reading_3: "Read texts A–D. For questions 18–24, decide which text answers the question.",
  reading_4: "Read the text and choose the correct answer for each question.",
  listening_1: "You will hear some short conversations. You will hear each conversation twice. Choose the correct answer to complete each conversation.",
  listening_2: "You will hear five conversations. Listen to the conversations and answer the questions. Choose the correct answer. You will hear each conversation twice.",
};

/** Old blueprint strings seeded into the DB before heading requirements were updated. If part.instructions matches one of these exactly we treat it as "not set" so the new defaults / mandatory flow kicks in. */
const LEGACY_INSTRUCTIONS: Record<string, string> = {
  listening_1: "Seven three-option multiple-choice questions. Play the audio twice.",
  listening_2: "Two three-option multiple-choice questions per conversation. Play the audio twice.",
  listening_3: "Seven gap answers of no more than three words. Play the audio twice.",
  listening_4: "Six three-option multiple-choice questions. Play the audio twice.",
};

/** Part codes that require the instructor to enter a heading before authoring questions. */
const MANDATORY_INSTRUCTIONS_PARTS = new Set(["listening_3", "listening_4"]);

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
  const isSpeaking = part.section_type === "speaking";
  const isLegacy = part.instructions !== undefined && part.instructions === LEGACY_INSTRUCTIONS[part.part_code];
  const savedInstruction = isLegacy ? "" : (part.instructions ?? "");
  const defaultInstruction = DEFAULT_INSTRUCTIONS[part.part_code] ?? "";
  const effectiveInstruction = savedInstruction || defaultInstruction;
  const isMandatoryInstruction = MANDATORY_INSTRUCTIONS_PARTS.has(part.part_code);
  const canEditPartInstructions = (Boolean(effectiveInstruction) || part.section_type === "reading" || part.section_type === "listening") && !isSpeaking;
  const instructionsLabel = t.instructionsLabel;
  const instructionsPlaceholder = DEFAULT_INSTRUCTIONS[part.part_code]
    ? `e.g. ${DEFAULT_INSTRUCTIONS[part.part_code]}`
    : t.instructionsPlaceholder;
  const instructionsEditLabel = t.instructionsEdit;
  const instructionsSaveLabel = t.instructionsSave;
  // Mandatory parts auto-open the editor when no instruction has been saved yet.
  const [isEditingInstructions, setIsEditingInstructions] = useState(
    () => isMandatoryInstruction && !savedInstruction
  );
  const [instructionsDraft, setInstructionsDraft] = useState(effectiveInstruction);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  useEffect(() => {
    const draft = savedInstruction || defaultInstruction;
    setInstructionsDraft(draft);
    // Re-open editor automatically if this part requires a heading and none is saved.
    setIsEditingInstructions(isMandatoryInstruction && !savedInstruction);
  }, [part.id, part.instructions, defaultInstruction, isMandatoryInstruction, savedInstruction]);

  useEffect(() => {
    setIsEditingTitle(false);
  }, [part.id]);

  function saveInstructions() {
    // Block save for mandatory-instruction parts when the draft is empty.
    if (isMandatoryInstruction && !instructionsDraft.trim()) return;
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
            <Button type="button" variant="primary" disabled={busy || !partTitle.trim()} onClick={saveTitle}>
              Save
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={cancelTitle}>
              Cancel
            </Button>
          </div>
        ) : (
          <>
            <h3 className="vh-unified-part-title" title={part.title}>{part.title}</h3>
            {isEditable && (
              <IconButton
                className="vh-title-edit-btn"
                onClick={() => setIsEditingTitle(true)}
                label="Rename section heading"
                title="Rename section heading"
                icon={<Icon name="edit" />}
              />
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

      {isEditable && onEntryModeChange && questionEntryMode && part.section_type !== "writing" && !part.part_code.startsWith("writing_") && (
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
              <RichTextEditor
                id={`part-instructions-${part.id}`}
                rows={3}
                value={instructionsDraft}
                onChange={setInstructionsDraft}
                placeholder={instructionsPlaceholder}
              />
              {isMandatoryInstruction && !instructionsDraft.trim() && (
                <p className="error-text" style={{ marginTop: "8px", marginBottom: "8px", fontSize: "12.5px", fontWeight: 550 }}>
                  A heading is required before you can author questions for this part.
                </p>
              )}
              <div className="vh-part-instructions-actions" style={{ marginTop: "6px" }}>
                <Button
                  type="button"
                  variant="primary"
                  disabled={busy || (isMandatoryInstruction && !instructionsDraft.trim())}
                  onClick={saveInstructions}
                  title={isMandatoryInstruction && !instructionsDraft.trim() ? "A heading is required for this part" : undefined}
                >
                  {instructionsSaveLabel}
                </Button>
                {/* Hide cancel for mandatory parts that have no saved heading yet */}
                {(!isMandatoryInstruction || Boolean(savedInstruction)) && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setInstructionsDraft(effectiveInstruction);
                      setIsEditingInstructions(false);
                    }}
                  >
                    {t.instructionsCancel}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              <p className="vh-part-instructions-preview">
                {effectiveInstruction || t.instructionsEmpty}
              </p>
              {isEditable && (
                <Button type="button" variant="secondary" onClick={() => setIsEditingInstructions(true)}>
                  {instructionsEditLabel}
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
