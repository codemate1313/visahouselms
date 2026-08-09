import type { FormEvent } from "react";
import { API_BASE_URL } from "@/api/client";
import { Icon } from "@/components/icons";
import { RequiredMark, SearchableSelect } from "@/components/ui";
import type { ExamModulePart, QuestionDraft, QuestionType, SpeakingTurnType } from "@/api/types";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";
import { ANSWER_FREE_TYPES, CHOICE_TYPES } from "../helpers";

interface ManualQuestionFormProps {
  part: ExamModulePart;
  manual: QuestionDraft;
  editingQuestionId: number | null;
  busy: boolean;
  uploadingImage: boolean;
  onChangeQuestionType: (type: QuestionType) => void;
  onUpdateOption: (index: number, text: string) => void;
  onToggleCorrect: (key: string) => void;
  onManualChange: (manual: QuestionDraft) => void;
  onUploadImage: (file: File) => void;
  onRemoveImage: () => void;
  onSubmit: (event: FormEvent) => void;
  onCancelEdit: () => void;
}

export function ManualQuestionForm({
  part,
  manual,
  editingQuestionId,
  busy,
  uploadingImage,
  onChangeQuestionType,
  onUpdateOption,
  onToggleCorrect,
  onManualChange,
  onUploadImage,
  onRemoveImage,
  onSubmit,
  onCancelEdit,
}: ManualQuestionFormProps) {
  const t = strings.manualQuestion;
  const questionLabels = strings.questionLabels;
  const allowedTypes = part.answer_constraints.allowed_question_types ?? [];
  const allowedTurns = part.answer_constraints.allowed_turn_types ?? [];
  const turnLabels: Record<SpeakingTurnType, string> = {
    identity: "Identity and origin",
    topic_question: "Familiar-topic question",
    roleplay_response: "Candidate responds in role play",
    roleplay_initiate: "Candidate initiates role play",
    read_aloud: "Read aloud",
    follow_up: "Follow-up question",
    presentation: "Extended presentation",
  };

  return (
    <section className="authoring-panel" id="manual-module-question">
      <div className="panel-title">
        <div>
          <span className="phase-chip">{t.eyebrow}</span>
          <h2>{editingQuestionId ? t.editHeading : t.addHeading(part.title)}</h2>
        </div>
      </div>
      <form className="question-form" onSubmit={onSubmit}>
        <label htmlFor="module-question-type">{t.typeLabel}</label>
        <SearchableSelect
          id="module-question-type"
          options={allowedTypes.map((type) => ({ value: type, label: questionLabels[type] }))}
          value={manual.question_type}
          onChange={(value) => onChangeQuestionType(String(value) as QuestionType)}
          searchable={false}
          className="form-dropdown-select"
        />
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
        <div className="field-label-with-action">
          <label htmlFor="module-question-passage">{t.passageLabel}</label>
          <label className={`image-upload-button${uploadingImage ? " is-busy" : ""}`}>
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
            <Icon name="image" />
            {uploadingImage ? t.uploadingImage : manual.image_url ? t.changeImage : t.addImage}
          </label>
        </div>
        <textarea
          id="module-question-passage"
          rows={4}
          value={manual.passage ?? ""}
          onChange={(event) => onManualChange({ ...manual, passage: event.target.value })}
          placeholder={t.passagePlaceholder}
        />
        <label htmlFor="module-question-instructions">{t.instructionsLabel}</label>
        <textarea
          id="module-question-instructions"
          rows={2}
          value={manual.instructions ?? ""}
          onChange={(event) => onManualChange({ ...manual, instructions: event.target.value })}
        />
        {manual.image_url && (
          <div className="question-image-preview">
            <img src={`${API_BASE_URL}${manual.image_url}`} alt={t.imagePreviewAlt} />
            <button type="button" className="danger-text" onClick={onRemoveImage}>
              {t.removeImage}
            </button>
          </div>
        )}
        <label htmlFor="module-question-prompt">{t.promptLabel}<RequiredMark /></label>
        <textarea
          id="module-question-prompt"
          rows={4}
          value={manual.prompt}
          onChange={(event) => onManualChange({ ...manual, prompt: event.target.value })}
          placeholder={part.answer_constraints.inline_marker_required ? t.inlinePromptPlaceholder : t.promptPlaceholder}
          required
        />
        {CHOICE_TYPES.has(manual.question_type) && (
          <fieldset className="option-editor">
            <legend>{t.optionsLegend}</legend>
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
              </div>
            ))}
          </fieldset>
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
        <div className="form-grid">
          <div>
            <label htmlFor="module-points">{t.pointsLabel}<RequiredMark /></label>
            <input
              id="module-points"
              type="number"
              min="0.01"
              step="0.01"
              value={manual.points}
              onChange={(event) => onManualChange({ ...manual, points: event.target.value })}
              required
            />
          </div>
          <div>
            <label htmlFor="module-difficulty">{t.difficultyLabel}</label>
            <SearchableSelect
              id="module-difficulty"
              options={[
                { value: "easy", label: t.difficultyEasy },
                { value: "medium", label: t.difficultyMedium },
                { value: "hard", label: t.difficultyHard },
              ]}
              value={manual.difficulty}
              onChange={(value) => onManualChange({ ...manual, difficulty: String(value) as QuestionDraft["difficulty"] })}
              searchable={false}
              className="form-dropdown-select"
            />
          </div>
        </div>
        <label htmlFor="module-explanation">{t.explanationLabel}</label>
        <textarea
          id="module-explanation"
          rows={3}
          value={manual.explanation ?? ""}
          onChange={(event) => onManualChange({ ...manual, explanation: event.target.value })}
        />
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
