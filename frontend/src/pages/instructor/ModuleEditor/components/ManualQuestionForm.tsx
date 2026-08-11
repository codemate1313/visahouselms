import type { FormEvent } from "react";
import { useRef } from "react";
import { API_BASE_URL } from "@/api/client";
import { Icon } from "@/components/icons";
import { RequiredMark, SearchableSelect } from "@/components/ui";
import type { ExamModulePart, QuestionDraft, SpeakingTurnType } from "@/api/types";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";
import { ANSWER_FREE_TYPES, CHOICE_TYPES } from "../helpers";

interface ManualQuestionFormProps {
  part: ExamModulePart;
  manual: QuestionDraft;
  editingQuestionId: number | null;
  busy: boolean;
  uploadingImage: boolean;
  uploadingAudio?: boolean;
  onAddOption: () => void;
  onRemoveOption: (index: number) => void;
  onUpdateOption: (index: number, text: string) => void;
  onToggleCorrect: (key: string) => void;
  onManualChange: (manual: QuestionDraft) => void;
  onUploadImage: (file: File) => void;
  onRemoveImage: () => void;
  onUploadAudio?: (file: File) => void;
  onRemoveAudio?: () => void;
  onSubmit: (event: FormEvent) => void;
  onCancelEdit: () => void;
}

export function ManualQuestionForm({
  part,
  manual,
  editingQuestionId,
  busy,
  uploadingImage,
  uploadingAudio = false,
  onAddOption,
  onRemoveOption,
  onUpdateOption,
  onToggleCorrect,
  onManualChange,
  onUploadImage,
  onRemoveImage,
  onUploadAudio,
  onRemoveAudio,
  onSubmit,
  onCancelEdit,
}: ManualQuestionFormProps) {
  const t = strings.manualQuestion;
  const isWriting = part.section_type === "writing";
  const isReading = part.section_type === "reading";
  const isListening1 = part.part_code === "listening_1";
  const isReading1a = part.part_code === "reading_1a";
  const isReading1b = part.part_code === "reading_1b";
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const allowedTurns = part.answer_constraints.allowed_turn_types ?? [];
  const isChoiceQuestion = CHOICE_TYPES.has(manual.question_type);
  const canRemoveOption = manual.options.length > 2;
  const showsBlankGuidance =
    manual.question_type === "fill_blank" ||
    part.answer_constraints.inline_marker_required ||
    part.answer_constraints.layout === "inline_matching_blanks" ||
    isReading1b;
  const turnLabels: Record<SpeakingTurnType, string> = {
    identity: "Identity and origin",
    topic_question: "Familiar-topic question",
    roleplay_response: "Candidate responds in role play",
    roleplay_initiate: "Candidate initiates role play",
    read_aloud: "Read aloud",
    follow_up: "Follow-up question",
    presentation: "Extended presentation",
  };

  function toggleBoldSelection() {
    const el = promptRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd, value } = el;
    if (selectionStart == null || selectionEnd == null || selectionStart === selectionEnd) return;
    const selected = value.slice(selectionStart, selectionEnd);
    const before = value.slice(0, selectionStart);
    const after = value.slice(selectionEnd);
    const isBold = selected.startsWith("**") && selected.endsWith("**") && selected.length > 4;
    const nextSelected = isBold ? selected.slice(2, -2) : `**${selected}**`;
    onManualChange({ ...manual, prompt: `${before}${nextSelected}${after}` });
    requestAnimationFrame(() => {
      el.focus();
      const cursor = before.length + nextSelected.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <section className="authoring-panel" id="manual-module-question">
      <div className="panel-title">
        <div>
          <h2>{editingQuestionId ? t.editHeading : t.addHeading(part.title)}</h2>
        </div>
      </div>
      <form className="question-form" onSubmit={onSubmit}>
        {showsBlankGuidance && (
          <div className="question-authoring-help">
            <h4>{t.blankHelpTitle}</h4>
            <p>{isReading1b ? t.blankHelpSharedCloze : t.blankHelp}</p>
          </div>
        )}
        {part.answer_constraints.group_label_required && (
          <>
            <label htmlFor="module-question-group">{t.groupLabel}<RequiredMark /></label>
            <input
              id="module-question-group"
              value={manual.interaction?.group_label ?? ""}
              onChange={(event) => onManualChange({
                ...manual,
                interaction: { ...manual.interaction, group_label: event.target.value },
              })}
              required
            />
          </>
        )}
        {allowedTurns.length > 0 && (
          <>
            <label htmlFor="module-question-turn">{t.turnTypeLabel}<RequiredMark /></label>
            <SearchableSelect
              id="module-question-turn"
              options={allowedTurns.map((turn) => ({ value: turn, label: turnLabels[turn] }))}
              value={manual.interaction?.turn_type ?? allowedTurns[0]}
              onChange={(value) => onManualChange({
                ...manual,
                interaction: { ...manual.interaction, turn_type: String(value) as SpeakingTurnType },
              })}
              searchable={false}
              className="form-dropdown-select"
            />
            <div className="form-grid">
              <div>
                <label htmlFor="module-question-preparation">{t.preparationSecondsLabel}</label>
                <input
                  id="module-question-preparation"
                  type="number"
                  min="0"
                  max="300"
                  value={manual.interaction?.preparation_seconds ?? 0}
                  onChange={(event) => onManualChange({
                    ...manual,
                    interaction: { ...manual.interaction, preparation_seconds: Number(event.target.value) },
                  })}
                />
              </div>
              <div>
                <label htmlFor="module-question-response">{t.responseSecondsLabel}</label>
                <input
                  id="module-question-response"
                  type="number"
                  min="5"
                  max="600"
                  value={manual.interaction?.response_seconds ?? 60}
                  onChange={(event) => onManualChange({
                    ...manual,
                    interaction: { ...manual.interaction, response_seconds: Number(event.target.value) },
                  })}
                />
              </div>
            </div>
            {manual.interaction?.turn_type === "follow_up" && (
              <label className="checkbox-row" htmlFor="module-question-adaptive">
                <input
                  id="module-question-adaptive"
                  type="checkbox"
                  checked={Boolean(manual.interaction?.adaptive_follow_up)}
                  onChange={(event) => onManualChange({
                    ...manual,
                    interaction: { ...manual.interaction, adaptive_follow_up: event.target.checked },
                  })}
                />
                <span>{t.adaptiveFollowUpLabel}</span>
              </label>
            )}
          </>
        )}
        {/* 1. Question or task prompt */}
        <div className="vh-prompt-label-row">
          <label htmlFor="module-question-prompt">{isListening1 ? "Question" : t.promptLabel}<RequiredMark /></label>
          {isReading1a && (
            <button
              type="button"
              className="vh-bold-toggle-button"
              onClick={toggleBoldSelection}
              title={t.boldSelectionHint}
            >
              <strong>B</strong> {t.boldSelectionLabel}
            </button>
          )}
        </div>
        {isReading1a && <p className="hint">{t.boldSelectionHint}</p>}
        <textarea
          id="module-question-prompt"
          ref={promptRef}
          rows={isListening1 ? 2 : 4}
          value={manual.prompt}
          onChange={(event) => onManualChange({ ...manual, prompt: event.target.value })}
          placeholder={isListening1 ? "Question 1" : (part.answer_constraints.inline_marker_required ? t.inlinePromptPlaceholder : t.promptPlaceholder)}
          required
        />

        {/* 2. Sleek Interactive Image Dropzone Pill (hidden for listening_1) */}
        {!isReading && !isListening1 && (
          <div className="vh-dropzone-pill-container">
            {!manual.image_url ? (
              <label className={`vh-dropzone-pill${uploadingImage ? " is-busy" : ""}`}>
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={uploadingImage}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onUploadImage(file);
                    event.target.value = "";
                  }}
                />
                <div className="vh-dropzone-icon-box">
                  <Icon name="image" />
                </div>
                <div className="vh-dropzone-text">
                  <span className="vh-dropzone-main">
                    {uploadingImage ? "Uploading image..." : "Attach Question Image (Optional)"}
                  </span>
                  <span className="vh-dropzone-sub">
                    Drag & drop image here or click to browse
                  </span>
                </div>
                <span className="vh-dropzone-btn">Browse</span>
              </label>
            ) : (
              <div className="vh-image-preview-card">
                <div className="vh-preview-header">
                  <span className="vh-preview-title">Question Image Attachment</span>
                  <button type="button" className="vh-remove-img-btn" onClick={onRemoveImage}>
                    <Icon name="x" />
                    Remove
                  </button>
                </div>
                <div className="vh-preview-image-wrapper">
                  <img src={`${API_BASE_URL}${manual.image_url}`} alt={t.imagePreviewAlt} className="vh-large-preview-img" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2b. Question Audio Dropzone Pill (For Listening Part 1) */}
        {isListening1 && (
          <div className="vh-dropzone-pill-container">
            {!manual.interaction?.audio_url && !manual.interaction?.audio_path ? (
              <label className={`vh-dropzone-pill${uploadingAudio ? " is-busy" : ""}`}>
                <input
                  type="file"
                  accept="audio/*"
                  hidden
                  disabled={uploadingAudio}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file && onUploadAudio) onUploadAudio(file);
                    event.target.value = "";
                  }}
                />
                <div className="vh-dropzone-icon-box">
                  <Icon name="play" />
                </div>
                <div className="vh-dropzone-text">
                  <span className="vh-dropzone-main">
                    {uploadingAudio ? "Uploading audio clip..." : "Attach Question Audio Clip (Optional)"}
                  </span>
                  <span className="vh-dropzone-sub">
                    Drag & drop MP3 audio file here or click to browse
                  </span>
                </div>
                <span className="vh-dropzone-btn">Browse</span>
              </label>
            ) : (
              <div className="vh-image-preview-card">
                <div className="vh-preview-header">
                  <span className="vh-preview-title">Question Audio Clip</span>
                  <button type="button" className="vh-remove-img-btn" onClick={onRemoveAudio}>
                    <Icon name="x" />
                    Remove
                  </button>
                </div>
                <div className="vh-preview-image-wrapper" style={{ padding: "12px 16px" }}>
                  <audio
                    controls
                    src={manual.interaction?.audio_url || `${API_BASE_URL}/storage/${manual.interaction?.audio_path}`}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* When the part owns one shared source text, it is edited in
            SharedPassagePanel above and copied down on save - repeating the
            field here is what made identical-passage mistakes so easy. */}
        {!isWriting && !part.answer_constraints.shared_passage && !isListening1 && (
          <>
            {/* 3. Passage or context */}
            <label htmlFor="module-question-passage">
              {t.passageLabel}
              {part.answer_constraints.passage_required && <RequiredMark />}
            </label>
            <textarea
              id="module-question-passage"
              rows={part.answer_constraints.shared_passage ? 8 : 4}
              value={manual.passage ?? ""}
              onChange={(event) => onManualChange({ ...manual, passage: event.target.value })}
              placeholder={t.passagePlaceholder}
              required={part.answer_constraints.passage_required}
            />

            {/* 4. Prompt instructions */}
            <label htmlFor="module-question-instructions">{t.instructionsLabel}</label>
            <textarea
              id="module-question-instructions"
              rows={2}
              value={manual.instructions ?? ""}
              onChange={(event) => onManualChange({ ...manual, instructions: event.target.value })}
            />
          </>
        )}
        {isChoiceQuestion && (
          <div className="option-editor" role="group" aria-labelledby="module-options-heading">
            <div className="option-editor-header">
              <h3 id="module-options-heading">{t.optionsLegend}</h3>
              <button type="button" className="option-add-button" onClick={onAddOption}>
                <Icon name="plus" />
                {t.addOption}
              </button>
            </div>
            {manual.options.map((option, index) => (
              <div className="option-edit-row" key={option.key}>
                <label className="answer-picker">
                  <input
                    type={manual.question_type === "mcq_multiple" ? "checkbox" : "radio"}
                    checked={manual.correct_answers.includes(option.key)}
                    onChange={() => onToggleCorrect(option.key)}
                  />
                  <span>{option.key}</span>
                </label>
                <input value={option.text} onChange={(event) => onUpdateOption(index, event.target.value)} required />
                <button
                  type="button"
                  className="option-remove-button"
                  onClick={() => onRemoveOption(index)}
                  disabled={!canRemoveOption}
                  aria-label={t.removeOption(option.key)}
                  title={canRemoveOption ? t.removeOption(option.key) : t.minimumOptions}
                >
                  <Icon name="x" />
                </button>
              </div>
            ))}
          </div>
        )}
        {!CHOICE_TYPES.has(manual.question_type) && !ANSWER_FREE_TYPES.has(manual.question_type) && (
          <>
            <label htmlFor="module-answers">{t.acceptedAnswersLabel}<RequiredMark /></label>
            <input
              id="module-answers"
              value={manual.correct_answers.join(", ")}
              onChange={(event) =>
                onManualChange({ ...manual, correct_answers: event.target.value.split(",").map((answer) => answer.trim()).filter(Boolean) })
              }
              placeholder={t.acceptedAnswersPlaceholder}
              required
            />
          </>
        )}

        <div className="form-actions">
          <button type="submit" disabled={busy}>
            {editingQuestionId ? t.updateQuestion : t.addQuestion}
          </button>
          {editingQuestionId && (
            <button type="button" className="secondary-button" onClick={onCancelEdit}>
              {t.cancel}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
