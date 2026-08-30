import { Checkbox, SearchableSelect } from "@/components/ui";
import { Button } from "@/components/ui/Button/Button";
import type { ModuleImportPreview, QuestionDraft, QuestionType } from "@/api/types";
import { ANSWER_FREE_TYPES } from "../helpers";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";

interface ModuleImportReviewPanelProps {
  preview: ModuleImportPreview;
  moduleTitle: string;
  selectedImports: Set<string>;
  onSelectedImportsChange: (selected: Set<string>) => void;
  onUpdatePreview: (partId: number, index: number, changes: Partial<QuestionDraft>) => void;
  onDiscard: () => void;
  onCommit: () => void;
  onOpenPart: (partId: number) => void;
  busy: boolean;
}

const keyFor = (partId: number, index: number) => `${partId}:${index}`;

export function ModuleImportReviewPanel({
  preview,
  moduleTitle,
  selectedImports,
  onSelectedImportsChange,
  onUpdatePreview,
  onDiscard,
  onCommit,
  onOpenPart,
  busy,
}: ModuleImportReviewPanelProps) {
  const t = strings.moduleImport;
  const review = strings.importReview;
  const questionLabels = strings.questionLabels;
  const allKeys = preview.parts.flatMap((part) => part.questions.map((_, index) => keyFor(part.part_id, index)));

  function toggleImport(partId: number, index: number) {
    const key = keyFor(partId, index);
    const next = new Set(selectedImports);
    if (next.has(key)) next.delete(key); else next.add(key);
    onSelectedImportsChange(next);
  }

  return (
    <section className="import-review">
      <div className="import-review-header">
        <div>
          <p style={{ margin: 0 }}>{t.reviewSummary(preview.question_count, preview.source_filename, moduleTitle)}</p>
        </div>
        <div className="review-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onSelectedImportsChange(selectedImports.size === allKeys.length ? new Set() : new Set(allKeys))}
          >
            {selectedImports.size === allKeys.length ? review.deselectAll : review.selectAll}
          </Button>
          <Button type="button" variant="secondary" onClick={onDiscard}>
            {review.discard}
          </Button>
          <Button type="button" onClick={onCommit} disabled={busy || !selectedImports.size}>
            {t.import(selectedImports.size)}
          </Button>
        </div>
      </div>

      {preview.warnings.length > 0 && (
        <div className="import-warning">
          <strong>{review.warningsHeading}</strong>
          <ul className="module-readiness-list">
            {preview.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="preview-list">
        {preview.parts.map((part) => {
          const allowedTypes = part.allowed_question_types ?? [];
          const passageRequired = part.section_type === "reading" && part.part_code !== "reading_1a";
          return (
            <section className="authoring-panel" key={part.part_id}>
              <div className="panel-title">
                <div>
                  <h3>{part.part_title}</h3>
                  <p>{t.partSummary(part.questions.length, part.part_title)}</p>
                </div>
                <Button type="button" variant="primary" onClick={() => onOpenPart(part.part_id)}>
                  {t.openPart(part.part_title)}
                </Button>
              </div>
              {passageRequired && (
                <div className="passage-editor-section" style={{ marginBottom: 18 }}>
                  <label style={{ fontWeight: 700, fontSize: "13px", display: "block", marginBottom: 6, color: "var(--text)" }}>Shared Passage Text</label>
                  <textarea
                    rows={5}
                    placeholder="Type or paste the reading passage here..."
                    value={part.questions[0]?.passage ?? ""}
                    onChange={(event) => {
                      const text = event.target.value;
                      part.questions.forEach((_, idx) => {
                        onUpdatePreview(part.part_id, idx, { passage: text });
                      });
                    }}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", fontFamily: "inherit" }}
                  />
                  <span className="field-hint" style={{ display: "block", marginTop: 4 }}>This part requires a passage. The text entered here will be saved to all questions.</span>
                </div>
              )}
              {part.questions.map((question, index) => {
                const selectedKey = keyFor(part.part_id, index);
                return (
                  <article className={`preview-question${selectedImports.has(selectedKey) ? " selected" : ""}`} key={selectedKey}>
                    <label className="preview-selector">
                      <Checkbox checked={selectedImports.has(selectedKey)} onChange={() => toggleImport(part.part_id, index)} /> {review.includeItem(index + 1)}
                    </label>
                    {allowedTypes.length > 1 && (
                      <>
                        <label>{review.typeLabel}</label>
                        <SearchableSelect
                          options={allowedTypes.map((type) => ({ value: type, label: questionLabels[type] }))}
                          value={question.question_type}
                          onChange={(value) => onUpdatePreview(part.part_id, index, { question_type: String(value) as QuestionType })}
                          searchable={false}
                          className="form-dropdown-select"
                          ariaLabel={review.typeAriaLabel(index + 1)}
                        />
                      </>
                    )}
                    <label>{review.promptLabel}</label>
                    <textarea rows={3} value={question.prompt} onChange={(event) => onUpdatePreview(part.part_id, index, { prompt: event.target.value })} />
                    {!ANSWER_FREE_TYPES.has(question.question_type) && (
                      <>
                        <label>{review.answerKeysLabel}</label>
                        <input
                          value={question.correct_answers.join(", ")}
                          onChange={(event) =>
                            onUpdatePreview(part.part_id, index, {
                              correct_answers: event.target.value.split(",").map((answer) => answer.trim()).filter(Boolean),
                            })
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
                );
              })}
            </section>
          );
        })}
      </div>
    </section>
  );
}
