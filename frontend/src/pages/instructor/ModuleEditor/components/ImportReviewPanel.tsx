import { Checkbox, SearchableSelect } from "@/components/ui";
import { Button } from "@/components/ui/Button/Button";
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
  const isListening1 = part.part_code === "listening_1" || part.part_code.endsWith("listening_1");

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
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              onSelectedImportsChange(
                selectedImports.size === preview.questions.length ? new Set() : new Set(preview.questions.map((_, index) => index))
              )
            }
          >
            {selectedImports.size === preview.questions.length ? t.deselectAll : t.selectAll}
          </Button>
          <Button variant="secondary" onClick={onDiscard}>
            {t.discard}
          </Button>
          <Button onClick={onCommit} disabled={busy || !selectedImports.size}>
            {t.import(selectedImports.size)}
          </Button>
        </div>
      </div>
      {preview.warnings.length > 0 && (
        <div className="import-warning">
          <strong>{t.warningsHeading}</strong>
          <ul className="module-readiness-list">
            {preview.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {part.answer_constraints?.passage_required && (
        <div className="authoring-panel" style={{ marginBottom: 18 }}>
          <div className="panel-title" style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700 }}>Shared Passage Text</h3>
          </div>
          <textarea
            rows={5}
            placeholder="Type or paste the reading passage here..."
            value={preview.questions[0]?.passage ?? ""}
            onChange={(event) => {
              const text = event.target.value;
              preview.questions.forEach((_, idx) => {
                onUpdatePreview(idx, { passage: text });
              });
            }}
            style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", fontFamily: "inherit" }}
          />
          <span className="field-hint" style={{ display: "block", marginTop: 4 }}>This part requires a passage. The text entered here will be saved to all questions.</span>
        </div>
      )}

      <div className="preview-list">
        {preview.questions.map((question, index) => (
          <article className={`preview-question${selectedImports.has(index) ? " selected" : ""}`} key={index}>
            <label className="preview-selector">
              <Checkbox checked={selectedImports.has(index)} onChange={() => toggleImport(index)} /> {t.includeItem(index + 1)}
            </label>
            {allowedTypes.length > 1 && (
              <>
                <label>{t.typeLabel}</label>
                <SearchableSelect
                  options={allowedTypes.map((type) => ({ value: type, label: questionLabels[type] }))}
                  value={question.question_type}
                  onChange={(value) => onUpdatePreview(index, { question_type: String(value) as QuestionType })}
                  searchable={false}
                  className="form-dropdown-select"
                  ariaLabel={t.typeAriaLabel(index + 1)}
                />
              </>
            )}
            {!isListening1 && (
              <>
                <label>{t.promptLabel}</label>
                <textarea rows={3} value={question.prompt} onChange={(event) => onUpdatePreview(index, { prompt: event.target.value })} />
              </>
            )}
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
