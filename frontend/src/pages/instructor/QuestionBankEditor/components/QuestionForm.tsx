import type { FormEvent } from "react";
import { RequiredMark, SearchableSelect } from "@/components/ui";
import type { QuestionDraft, QuestionType } from "@/api/types";
import { questionBankEditorStrings as strings } from "../QuestionBankEditor.strings";
import { ANSWER_FREE_TYPES, CHOICE_TYPES, QUESTION_TYPES } from "../helpers";

interface QuestionFormProps {
  question: QuestionDraft;
  onChange: (question: QuestionDraft) => void;
  onTypeChange: (type: QuestionType) => void;
  onOptionChange: (index: number, text: string) => void;
  onAddOption: () => void;
  onRemoveOption: (index: number) => void;
  onToggleCorrect: (key: string) => void;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
  saving: boolean;
  editing: boolean;
}

export function QuestionForm({
  question,
  onChange,
  onTypeChange,
  onOptionChange,
  onAddOption,
  onRemoveOption,
  onToggleCorrect,
  onSubmit,
  onCancel,
  saving,
  editing,
}: QuestionFormProps) {
  const t = strings.manualQuestion;
  const hasChoices = CHOICE_TYPES.has(question.question_type);
  return (
    <form className="question-form" onSubmit={onSubmit}>
      <div className="form-grid">
        <div>
          <label htmlFor="question-type">{t.typeLabel}</label>
          <SearchableSelect
            id="question-type"
            options={QUESTION_TYPES}
            value={question.question_type}
            onChange={(value) => onTypeChange(String(value) as QuestionType)}
            searchable={false}
            className="form-dropdown-select"
          />
        </div>
        <div>
          <label htmlFor="question-difficulty">{t.difficultyLabel}</label>
          <SearchableSelect
            id="question-difficulty"
            options={[
              { value: "easy", label: t.difficultyEasy },
              { value: "medium", label: t.difficultyMedium },
              { value: "hard", label: t.difficultyHard },
            ]}
            value={question.difficulty}
            onChange={(value) => onChange({ ...question, difficulty: String(value) as QuestionDraft["difficulty"] })}
            searchable={false}
            className="form-dropdown-select"
          />
        </div>
      </div>
      <label htmlFor="question-instructions">{t.instructionsLabel}</label>
      <input
        id="question-instructions"
        value={question.instructions ?? ""}
        onChange={(event) => onChange({ ...question, instructions: event.target.value })}
        placeholder={t.instructionsPlaceholder}
      />
      <label htmlFor="question-passage">{t.passageLabel}</label>
      <textarea
        id="question-passage"
        value={question.passage ?? ""}
        onChange={(event) => onChange({ ...question, passage: event.target.value })}
        rows={4}
        placeholder={t.passagePlaceholder}
      />
      <label htmlFor="question-prompt">{t.promptLabel}<RequiredMark /></label>
      <textarea id="question-prompt" value={question.prompt} onChange={(event) => onChange({ ...question, prompt: event.target.value })} rows={4} required />
      {hasChoices && (
        <fieldset className="option-editor">
          <legend>{t.choicesLegend}</legend>
          {question.options.map((option, index) => (
            <div className="option-edit-row" key={option.key}>
              <label className="answer-picker" title="Mark correct">
                <input
                  type={question.question_type === "mcq_multiple" ? "checkbox" : "radio"}
                  name="correct-option"
                  checked={question.correct_answers.includes(option.key)}
                  onChange={() => onToggleCorrect(option.key)}
                />
                <span>{option.key}</span>
              </label>
              <input aria-label={`Option ${option.key}`} value={option.text} onChange={(event) => onOptionChange(index, event.target.value)} required />
              <button
                type="button"
                className="remove-option"
                aria-label={`Remove option ${option.key}`}
                disabled={question.options.length <= 2}
                onClick={() => onRemoveOption(index)}
              >
                ×
              </button>
            </div>
          ))}
          {question.question_type.startsWith("mcq_") && (
            <button type="button" className="secondary-button add-option" onClick={onAddOption}>
              {t.addChoice}
            </button>
          )}
        </fieldset>
      )}
      {!hasChoices && !ANSWER_FREE_TYPES.has(question.question_type) && (
        <>
          <label htmlFor="accepted-answers">{t.acceptedAnswersLabel}<RequiredMark /></label>
          <input
            id="accepted-answers"
            value={question.correct_answers.join(", ")}
            onChange={(event) => onChange({ ...question, correct_answers: event.target.value.split(",").map((answer) => answer.trim()).filter(Boolean) })}
            placeholder={t.acceptedAnswersPlaceholder}
            required
          />
        </>
      )}
      <div className="form-grid">
        <div>
          <label htmlFor="question-points">{t.pointsLabel}<RequiredMark /></label>
          <input
            id="question-points"
            type="number"
            min="0.01"
            max="9999"
            step="0.01"
            value={question.points}
            onChange={(event) => onChange({ ...question, points: event.target.value })}
            required
          />
        </div>
        <div>
          <label htmlFor="question-explanation">{t.explanationLabel}</label>
          <input
            id="question-explanation"
            value={question.explanation ?? ""}
            onChange={(event) => onChange({ ...question, explanation: event.target.value })}
            placeholder={t.explanationPlaceholder}
          />
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" disabled={saving}>
          {saving ? t.saving : editing ? t.updateQuestion : t.addQuestion}
        </button>
        {editing && (
          <button type="button" onClick={onCancel}>
            {t.cancelEdit}
          </button>
        )}
      </div>
    </form>
  );
}
