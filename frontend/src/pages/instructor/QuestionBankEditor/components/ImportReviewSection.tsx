import { SearchableSelect } from "@/components/ui";
import type { QuestionDraft, QuestionImportPreview, QuestionType } from "@/api/types";
import { questionBankEditorStrings as strings } from "../QuestionBankEditor.strings";
import { QUESTION_TYPES } from "../helpers";

interface ImportReviewSectionProps {
  preview: QuestionImportPreview;
  selectedImports: Set<number>;
  onSelectedImportsChange: (selected: Set<number>) => void;
  onUpdatePreviewQuestion: (index: number, update: Partial<QuestionDraft>) => void;
  onUpdatePreviewOption: (questionIndex: number, optionIndex: number, text: string) => void;
  onDiscard: () => void;
  onCommit: () => void;
  importing: boolean;
}

export function ImportReviewSection({
  preview,
  selectedImports,
  onSelectedImportsChange,
  onUpdatePreviewQuestion,
  onUpdatePreviewOption,
  onDiscard,
  onCommit,
  importing,
}: ImportReviewSectionProps) {
  const t = strings.importReview;

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
          <p>{t.summary(preview.question_count, preview.warning_count, preview.source_filename)}</p>
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
          <button onClick={onCommit} disabled={importing || selectedImports.size === 0}>
            {importing ? t.importing : t.import(selectedImports.size)}
          </button>
        </div>
      </div>
      {preview.warnings.length > 0 && (
        <div className="import-warning">
          <strong>{t.warningsHeading}</strong>
          <ul>
            {preview.warnings.slice(0, 12).map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
          {preview.warnings.length > 12 && <p>{t.moreWarnings(preview.warnings.length - 12)}</p>}
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
              <input type="checkbox" checked={selectedImports.has(index)} onChange={() => toggleImport(index)} /> {t.includeQuestion(index + 1)}
            </label>
            <div className="form-grid">
              <div>
                <label>{t.typeLabel}</label>
                <SearchableSelect
                  options={QUESTION_TYPES}
                  value={question.question_type}
                  onChange={(value) => onUpdatePreviewQuestion(index, { question_type: String(value) as QuestionType })}
                  searchable={false}
                  className="form-dropdown-select"
                />
              </div>
              <div>
                <label>{t.answerKeysLabel}</label>
                <input
                  value={question.correct_answers.join(", ")}
                  onChange={(event) =>
                    onUpdatePreviewQuestion(index, {
                      correct_answers: event.target.value.split(",").map((answer) => answer.trim().toUpperCase()).filter(Boolean),
                    })
                  }
                  placeholder={t.answerKeysPlaceholder}
                />
              </div>
            </div>
            <label>{t.questionLabel}</label>
            <textarea rows={3} value={question.prompt} onChange={(event) => onUpdatePreviewQuestion(index, { prompt: event.target.value })} />
            {question.options.length > 0 && (
              <div className="preview-options">
                {question.options.map((option, optionIndex) => (
                  <label key={option.key}>
                    <span>{option.key}</span>
                    <input value={option.text} onChange={(event) => onUpdatePreviewOption(index, optionIndex, event.target.value)} />
                  </label>
                ))}
              </div>
            )}
            {!!question.warnings?.length && <p className="question-warning">{question.warnings.join(" · ")}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
