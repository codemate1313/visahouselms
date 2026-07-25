import { Checkbox, SearchableSelect } from "@/components/ui";
import type { ExamModule, ExamModulePart, QuestionDraft, QuestionImportPreview, QuestionType } from "@/api/types";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";
import { ANSWER_FREE_TYPES } from "../helpers";

interface ImportReviewPanelProps {
  module: ExamModule;
  part: ExamModulePart;
  preview: QuestionImportPreview;
  selectedImports: Set<number>;
  onSelectedImportsChange: (selected: Set<number>) => void;
  onUpdatePreview: (index: number, changes: Partial<QuestionDraft>) => void;
  onDiscard: () => void;
  onCommit: () => void;
  busy: boolean;
}

export function ImportReviewPanel({
  module,
  part,
  preview,
  selectedImports,
  onSelectedImportsChange,
  onUpdatePreview,
  onDiscard,
  onCommit,
  busy,
}: ImportReviewPanelProps) {
  const t = strings.importReview;
  const questionLabels = strings.questionLabels;
  const allowedTypes = part.answer_constraints.allowed_question_types ?? [];

  function toggleImport(index: number) {
    const next = new Set(selectedImports);
    if (next.has(index)) next.delete(index); else next.add(index);
    onSelectedImportsChange(next);
  }

  return (
    <section className="import-review">
      <div className="import-review-header">
        <div>
          <h2>{t.heading}</h2>
          <p>{t.summary(preview.question_count, preview.source_filename, module.title, part.title)}</p>
        </div>
        <div className="review-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              onSelectedImportsChange(
                selectedImports.size === preview.questions.length ? new Set() : new Set(preview.questions.map((_, index) => index))
              )
            }
          >
            {selectedImports.size === preview.questions.length ? t.deselectAll : t.selectAll}
          </button>
          <button className="secondary-button" onClick={onDiscard}>
            {t.discard}
          </button>
          <button onClick={onCommit} disabled={busy || !selectedImports.size}>
            {t.import(selectedImports.size)}
          </button>
        </div>
      </div>
      {preview.warnings.length > 0 && (
        <div className="import-warning">
          <strong>{t.warningsHeading}</strong>
          <ul>
            {preview.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
      <details className="source-content">
        <summary>{t.sourceTextSummary}</summary>
        <pre>{preview.source_text}</pre>
      </details>
      <div className="preview-list">
        {preview.questions.map((question, index) => (
          <article className={`preview-question${selectedImports.has(index) ? " selected" : ""}`} key={index}>
            <label className="preview-selector">
              <Checkbox checked={selectedImports.has(index)} onChange={() => toggleImport(index)} /> {t.includeItem(index + 1)}
            </label>
            <label>{t.typeLabel}</label>
            <SearchableSelect
              options={allowedTypes.map((type) => ({ value: type, label: questionLabels[type] }))}
              value={question.question_type}
              onChange={(value) => onUpdatePreview(index, { question_type: String(value) as QuestionType })}
              searchable={false}
              className="form-dropdown-select"
              ariaLabel={t.typeAriaLabel(index + 1)}
            />
            <label>{t.promptLabel}</label>
            <textarea rows={3} value={question.prompt} onChange={(event) => onUpdatePreview(index, { prompt: event.target.value })} />
            {!ANSWER_FREE_TYPES.has(question.question_type) && (
              <>
                <label>{t.answerKeysLabel}</label>
                <input
                  value={question.correct_answers.join(", ")}
                  onChange={(event) =>
                    onUpdatePreview(index, { correct_answers: event.target.value.split(",").map((answer) => answer.trim()).filter(Boolean) })
                  }
                />
              </>
            )}
            {question.options.length > 0 && (
              <ol className="saved-options" type="A">
                {question.options.map((option) => (
                  <li key={option.key}>{option.text}</li>
                ))}
              </ol>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
