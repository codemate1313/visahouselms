import { useEffect, useMemo, useState, useRef } from "react";
import type { ExamModulePart } from "@/api/types";
import { Button, RequiredMark, RichTextEditor } from "@/components/ui";
import { Icon } from "@/components/icons";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";

export interface NotepadTaskDraft {
  notepad: string;
  answers: Record<number, string[]>;
}

interface NotepadGapsComposerProps {
  part: ExamModulePart;
  isEditable: boolean;
  busy: boolean;
  onSubmit: (draft: NotepadTaskDraft) => void;
  onDelete?: () => void;
}

const BLANK_MARKER = /\{\{blank:(\d+)\}\}/g;

function splitAlternatives(value: string) {
  return value.split("|").map((item) => item.trim()).filter(Boolean);
}

export function NotepadGapsComposer({ part, isEditable, busy, onSubmit, onDelete }: NotepadGapsComposerProps) {
  const t = strings.notepadTask;
  const maxWords = part.answer_constraints.max_answer_words ?? 3;
  const existing = part.questions;

  const [notepad, setNotepad] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isEditing, setIsEditing] = useState(existing.length === 0);

  const savedSignature = existing
    .map((question) => `${question.id}:${(question.correct_answers ?? []).join("+")}`)
    .join("|");

  useEffect(() => {
    setNotepad(existing[0]?.passage ?? "");
    setAnswers(
      Object.fromEntries(
        existing.map((question, index) => [index + 1, (question.correct_answers ?? []).join(" | ")]),
      ),
    );
    setIsEditing(existing.length === 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [part.id, savedSignature]);

  const blanks = useMemo(() => {
    const found: number[] = [];
    BLANK_MARKER.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = BLANK_MARKER.exec(notepad)) !== null) found.push(Number(match[1]));
    return [...new Set(found)].sort((a, b) => a - b);
  }, [notepad]);

  const expectedBlanks = part.question_limit ?? blanks.length;
  const answered = blanks.filter((blank) => splitAlternatives(answers[blank] ?? "").length > 0);
  const overLong = blanks.filter((blank) =>
    splitAlternatives(answers[blank] ?? "").some((answer) => answer.split(/\s+/).length > maxWords));

  const existingGaps = useMemo(() => new Set(blanks), [blanks]);

  const nextGapNumber = useMemo(() => {
    for (let i = 1; i <= expectedBlanks; i++) {
      if (!existingGaps.has(i)) return i;
    }
    return (existingGaps.size > 0 ? Math.max(...Array.from(existingGaps)) : 0) + 1;
  }, [existingGaps, expectedBlanks]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insertBlank(gapNum?: number) {
    if (!isEditing) setIsEditing(true);
    const el = textareaRef.current;
    const targetGap = gapNum ?? nextGapNumber;
    const blankTag = `{{blank:${targetGap}}}`;
    if (!el) {
      setNotepad((prev) => (prev ? `${prev} ${blankTag}` : blankTag));
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    const newText = `${before}${blankTag}${after}`;
    setNotepad(newText);
    requestAnimationFrame(() => {
      el.focus();
      const newPos = start + blankTag.length;
      el.setSelectionRange(newPos, newPos);
    });
  }

  const problems: string[] = [];
  if (!notepad.trim()) problems.push(t.errors.noNotepad);
  if (blanks.length !== expectedBlanks) problems.push(t.errors.blankCount(blanks.length, expectedBlanks));
  if (blanks.some((blank, index) => blank !== index + 1)) problems.push(t.errors.blankSequence);
  if (answered.length !== blanks.length) problems.push(t.errors.missingAnswers(blanks.length - answered.length));
  overLong.forEach((blank) => problems.push(t.errors.answerTooLong(blank, maxWords)));

  const ready = problems.length === 0;

  const handleSave = () => {
    onSubmit({
      notepad,
      answers: Object.fromEntries(blanks.map((blank) => [blank, splitAlternatives(answers[blank] ?? "")])),
    });
  };

  return (
    <section className="authoring-panel gap-task-composer">
      <div className="panel-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <span className="phase-chip">{t.eyebrow}</span>
          <h2>{t.heading(part.title)}</h2>
        </div>
        {isEditable && (
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {isEditing ? (
              <>
                {existing.length > 0 && (
                  <Button variant="secondary" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                )}
                <Button
                  variant="primary"
                  disabled={busy || !ready}
                  onClick={handleSave}
                  style={{ gap: "6px" }}
                >
                  <Icon name="check" /> {busy ? t.saving : "Save Notepad"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setIsEditing(true)} style={{ gap: "6px" }}>
                  <Icon name="edit" /> Edit Notepad
                </Button>
                {onDelete && (
                  <Button variant="danger" onClick={onDelete} style={{ gap: "6px" }}>
                    <Icon name="trash" /> Delete Task
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {existing.length > 0 && !isEditing && (
        <div
          style={{
            padding: "14px 18px",
            background: "var(--surface-muted, #f8fafc)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            margin: "8px 0 16px",
          }}
        >
          {/* Editing is started from the header button only - a second one
              here was the same action twice, side by side. */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Icon name="check" style={{ color: "#10b981", fontSize: "18px" }} />
            <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text, #111113)" }}>
              Notepad Task Saved ({existing.length} blank{existing.length === 1 ? "" : "s"}, {existing.length} mark{existing.length === 1 ? "" : "s"})
            </span>
          </div>
        </div>
      )}

      {isEditing && (
        <div className="question-authoring-help">
          <h4>{t.helpTitle}</h4>
          <p>{t.help}</p>
        </div>
      )}

      {isEditing && isEditable && (
        <div className="vh-passage-blank-toolbar" style={{ marginTop: "12px", marginBottom: "14px" }}>
          <div className="vh-passage-blank-main-actions">
            <button
              type="button"
              className="vh-insert-blank-btn"
              onClick={() => insertBlank(nextGapNumber)}
              title="Click where you want the blank in the notepad, then click here to insert it."
            >
              <Icon name="plus" className="vh-btn-icon" style={{ width: "15px", height: "15px", strokeWidth: 2.5 }} />
              <span>Insert Gap {nextGapNumber <= expectedBlanks ? `(${nextGapNumber})` : ""}</span>
            </button>
            <span className="vh-passage-blank-hint">
              Position cursor in the notepad and click <strong>Insert Gap</strong> (or click a gap pill below)
            </span>
          </div>

          <div className="vh-gap-pill-list" aria-label="Notepad gaps status">
            {Array.from({ length: expectedBlanks }, (_, i) => i + 1).map((gapNum) => {
              const present = existingGaps.has(gapNum);
              return (
                <button
                  key={gapNum}
                  type="button"
                  className={`vh-gap-pill ${present ? "is-present" : "is-missing"}`}
                  onClick={() => insertBlank(gapNum)}
                  title={present ? `Gap ${gapNum} is in notepad. Click to insert another marker.` : `Click to insert Gap ${gapNum} at cursor`}
                >
                  {present ? (
                    <>
                      <Icon name="check" className="vh-btn-icon" style={{ width: "11px", height: "11px", strokeWidth: 3 }} />
                      <span>Gap {gapNum}</span>
                    </>
                  ) : (
                    <>
                      <Icon name="plus" className="vh-btn-icon" style={{ width: "11px", height: "11px", strokeWidth: 3 }} />
                      <span>Gap {gapNum}</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <label htmlFor="notepad-task-text">{t.notepadLabel}<RequiredMark /></label>
      <RichTextEditor
        ref={textareaRef}
        id="notepad-task-text"
        className="gap-task-passage"
        rows={14}
        value={notepad}
        onChange={setNotepad}
        placeholder={t.notepadPlaceholder}
        readOnly={!isEditable || !isEditing}
      />

      <h3 className="gap-task-subheading">{t.answersHeading}</h3>
      {blanks.length === 0 ? (
        <p className="gap-task-empty">{t.noBlanks}</p>
      ) : (
        <div className="gap-task-answers">
          {blanks.map((blank) => {
            const value = answers[blank] ?? "";
            const tooLong = splitAlternatives(value).some((answer) => answer.split(/\s+/).length > maxWords);
            return (
              <div className="gap-task-answer-row" key={blank}>
                <span className="gap-task-gap-label">{t.blankLabel(blank)}</span>
                <input
                  className={tooLong ? "is-error" : ""}
                  value={value}
                  aria-label={t.blankLabel(blank)}
                  placeholder={t.answerPlaceholder}
                  onChange={(event) => setAnswers({ ...answers, [blank]: event.target.value })}
                  readOnly={!isEditable || !isEditing}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel and Save live in the panel header only - a second pair down
          here was the same two actions twice on one screen. */}
      {isEditing && problems.length > 0 && (
        <ul className="gap-task-problems">
          {problems.map((problem) => <li key={problem}>{problem}</li>)}
        </ul>
      )}
    </section>
  );
}
