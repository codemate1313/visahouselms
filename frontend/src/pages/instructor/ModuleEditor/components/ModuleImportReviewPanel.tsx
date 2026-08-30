import { API_BASE_URL } from "@/api/client";
import { Icon } from "@/components/icons";
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
  onUploadImage: (partId: number, index: number, file: File) => void;
  onRemoveImage: (partId: number, index: number) => void;
  uploadingImageKey: string | null;
  busy: boolean;
}

/* Image attachments only make sense for writing tasks (a chart/graph the
   candidate describes) - reading, listening, and speaking parts source their
   visuals elsewhere or not at all. Matches the same section_type check
   ManualQuestionForm uses to decide whether to offer an image dropzone. */
const IMAGE_ELIGIBLE_SECTIONS = new Set(["writing"]);

const keyFor = (partId: number, index: number) => `${partId}:${index}`;

const NOTEPAD_BLANK_RE = /\{\{blank:(\d+)\}\}/g;

/* Mirrors NotepadGapsGroup's own split: a first line with no blank marker is
   the notepad's heading, everything else is the body shown line by line. */
function splitNotepad(passage: string) {
  const allLines = passage.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const hasHeading = allLines.length > 1 && !allLines[0].includes("{{blank:");
  return {
    heading: hasHeading ? allLines[0] : null,
    lines: hasHeading ? allLines.slice(1) : allLines,
  };
}

/* Shows the shared passage the way students will see it - heading plus a
   gapped paragraph - instead of the raw {{blank:N}} markers, so the reviewer
   can tell at a glance whether the import produced real notepad content. */
function NotepadPreview({ passage, questions }: { passage: string; questions: QuestionDraft[] }) {
  const { heading, lines } = splitNotepad(passage);
  if (!heading && lines.length === 0) return null;
  return (
    <div
      style={{
        marginTop: 12,
        padding: "12px 14px",
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: "var(--surface-color-variant, rgba(255,255,255,0.03))",
        fontSize: "14px",
        lineHeight: 1.6,
      }}
    >
      {heading && <div style={{ fontWeight: 700, marginBottom: 8 }}>{heading}</div>}
      {lines.map((line, lineIndex) => {
        NOTEPAD_BLANK_RE.lastIndex = 0;
        const parts: (string | { blankIndex: number })[] = [];
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = NOTEPAD_BLANK_RE.exec(line)) !== null) {
          if (match.index > lastIndex) parts.push(line.slice(lastIndex, match.index));
          parts.push({ blankIndex: Number(match[1]) });
          lastIndex = match.index + match[0].length;
        }
        if (lastIndex < line.length) parts.push(line.slice(lastIndex));
        return (
          <p key={lineIndex} style={{ margin: "0 0 6px" }}>
            {parts.map((part, partIndex) =>
              typeof part === "string" ? (
                <span key={partIndex}>{part}</span>
              ) : (
                <strong key={partIndex} style={{ padding: "0 4px", borderBottom: "1px solid var(--text)" }}>
                  {questions[part.blankIndex - 1]?.correct_answers?.[0] || `(${part.blankIndex})`}
                </strong>
              ),
            )}
          </p>
        );
      })}
    </div>
  );
}

export function ModuleImportReviewPanel({
  preview,
  moduleTitle,
  selectedImports,
  onSelectedImportsChange,
  onUpdatePreview,
  onDiscard,
  onCommit,
  onUploadImage,
  onRemoveImage,
  uploadingImageKey,
  busy,
}: ModuleImportReviewPanelProps) {
  const t = strings.moduleImport;
  const review = strings.importReview;
  const manualStrings = strings.manualQuestion;
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
          const isNotepadGaps = part.layout === "notepad_gaps";
          const passageRequired = part.section_type === "reading" && part.part_code !== "reading_1a";
          const partNeedsImage = IMAGE_ELIGIBLE_SECTIONS.has(part.section_type);
          const isListening1 = part.part_code === "listening_1" || part.part_code.endsWith("listening_1");
          const isReading1b = part.part_code === "reading_1b" || part.part_code.endsWith("reading_1b");
          const isReading2 = part.part_code === "reading_2" || part.part_code.endsWith("reading_2");
          return (
            <section className="authoring-panel" key={part.part_id}>
              <div className="panel-title">
                <div>
                  <h3>{part.part_title}</h3>
                  <p>{t.partSummary(part.questions.length, part.part_title)}</p>
                </div>
              </div>
              {(passageRequired || isNotepadGaps) && (
                <div className="passage-editor-section" style={{ marginBottom: 18 }}>
                  <label style={{ fontWeight: 700, fontSize: "13px", display: "block", marginBottom: 6, color: "var(--text)" }}>
                    {isNotepadGaps ? "Notepad Heading & Passage" : "Shared Passage Text"}
                  </label>
                  <textarea
                    rows={isNotepadGaps ? 8 : 5}
                    placeholder={
                      isNotepadGaps
                        ? "First line is the heading. Below it, write the notepad text with {{blank:1}}, {{blank:2}}... in order."
                        : "Type or paste the reading passage here..."
                    }
                    value={part.questions[0]?.passage ?? ""}
                    onChange={(event) => {
                      const text = event.target.value;
                      part.questions.forEach((_, idx) => {
                        onUpdatePreview(part.part_id, idx, { passage: text });
                      });
                    }}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", fontFamily: "inherit" }}
                  />
                  <span className="field-hint" style={{ display: "block", marginTop: 4 }}>
                    {isNotepadGaps
                      ? "This is the notepad students see. The {{blank:N}} markers must stay in order - each one links to the answer for that numbered item below."
                      : "This part requires a passage. The text entered here will be saved to all questions."}
                  </span>
                  {isNotepadGaps && <NotepadPreview passage={part.questions[0]?.passage ?? ""} questions={part.questions} />}
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
                    {isReading1b ? (
                      <div style={{ marginBottom: 12, padding: "8px 12px", background: "rgba(185, 28, 43, 0.04)", borderRadius: "8px", border: "1px solid rgba(185, 28, 43, 0.15)", fontSize: "13px" }}>
                        <span style={{ fontWeight: 700, color: "var(--sa-sidebar-red, #b91c2b)" }}>Gap ({index + 1})</span>
                        <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>— Options for gap ({index + 1}) in the passage</span>
                      </div>
                    ) : isReading2 ? (
                      <div style={{ marginBottom: 12, padding: "8px 12px", background: "rgba(185, 28, 43, 0.04)", borderRadius: "8px", border: "1px solid rgba(185, 28, 43, 0.15)", fontSize: "13px" }}>
                        <span style={{ fontWeight: 700, color: "var(--sa-sidebar-red, #b91c2b)" }}>Blank {index + 1}</span>
                        <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>— Inline blank {`{{blank:${index + 1}}}`} in the passage</span>
                      </div>
                    ) : !isListening1 ? (
                      <>
                        <label>{review.promptLabel}</label>
                        <textarea rows={3} value={question.prompt} onChange={(event) => onUpdatePreview(part.part_id, index, { prompt: event.target.value })} />
                      </>
                    ) : null}
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
                    {partNeedsImage && (
                      <div className="vh-dropzone-pill-container" style={{ marginTop: 12 }}>
                        {!question.image_url ? (
                          <label className={`vh-dropzone-pill${uploadingImageKey === selectedKey ? " is-busy" : ""}`}>
                            <input
                              type="file"
                              accept="image/*"
                              hidden
                              disabled={uploadingImageKey === selectedKey}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) onUploadImage(part.part_id, index, file);
                                event.target.value = "";
                              }}
                            />
                            <div className="vh-dropzone-icon-box">
                              <Icon name="image" />
                            </div>
                            <div className="vh-dropzone-text">
                              <span className="vh-dropzone-main">
                                {uploadingImageKey === selectedKey ? manualStrings.uploadingImage : manualStrings.addImage}
                              </span>
                            </div>
                            <span className="vh-dropzone-btn">Browse</span>
                          </label>
                        ) : (
                          <div className="vh-image-preview-card">
                            <div className="vh-preview-header">
                              <span className="vh-preview-title">{manualStrings.addImage}</span>
                              <Button type="button" variant="text" className="vh-remove-img-btn" onClick={() => onRemoveImage(part.part_id, index)}>
                                <Icon name="x" />
                                {manualStrings.removeImage}
                              </Button>
                            </div>
                            <div className="vh-preview-image-wrapper">
                              <img src={`${API_BASE_URL}${question.image_url}`} alt={manualStrings.imagePreviewAlt} className="vh-large-preview-img" />
                            </div>
                          </div>
                        )}
                      </div>
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
