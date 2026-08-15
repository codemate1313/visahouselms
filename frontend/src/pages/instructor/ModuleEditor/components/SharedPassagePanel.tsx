import { useEffect, useMemo, useRef, useState } from "react";
import type { ExamModulePart } from "@/api/types";
import { Button } from "@/components/ui";
import { Icon } from "@/components/icons";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";

interface SharedPassagePanelProps {
  part: ExamModulePart;
  isEditable: boolean;
  busy: boolean;
  onSave: (passage: string) => void;
  onDelete?: () => void;
}

/**
 * One source text for the whole part.
 *
 * The passage is stored per question in the data model, and validation requires
 * every question in a shared-passage part to carry a byte-identical copy. Asking
 * an author to paste the same text into five questions is both tedious and the
 * most likely way to fail that check, so the part owns the passage here and
 * writes it down to every question on save.
 */
export function SharedPassagePanel({ part, isEditable, busy, onSave, onDelete }: SharedPassagePanelProps) {
  const t = strings.sharedPassage;
  const storedPassage = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(`vh.passage.${part.id}`) || "" : "";
  const saved = (part.questions[0]?.passage ?? storedPassage).trim();
  const [draft, setDraft] = useState(saved);
  const [isEditing, setIsEditing] = useState(saved.length === 0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Re-sync when the part changes or the module reloads after a save.
  useEffect(() => {
    const currentStored = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(`vh.passage.${part.id}`) || "" : "";
    const effective = (part.questions[0]?.passage ?? currentStored).trim();
    setDraft(effective);
    setIsEditing(effective.length === 0);
  }, [part.id]);

  useEffect(() => {
    if (saved.length > 0 && !draft.trim()) {
      setDraft(saved);
    }
  }, [saved]);

  const dirty = draft.trim() !== saved;
  const mismatched = part.questions.some(
    (question) => (question.passage ?? "").trim() !== saved,
  );

  const isClozePart =
    part.part_code === "reading_1b" ||
    part.answer_constraints.layout === "shared_cloze" ||
    part.answer_constraints.layout === "inline_matching_blanks";
  const limit = part.question_limit ?? 5;

  const existingGaps = useMemo(() => {
    const matches = Array.from(draft.matchAll(/\{\{blank:?(\d+)?\}\}/g));
    return new Set(matches.map((m) => (m[1] ? parseInt(m[1], 10) : 1)));
  }, [draft]);

  const nextGapNumber = useMemo(() => {
    for (let i = 1; i <= limit; i++) {
      if (!existingGaps.has(i)) return i;
    }
    return (existingGaps.size > 0 ? Math.max(...Array.from(existingGaps)) : 0) + 1;
  }, [existingGaps, limit]);

  function insertBlank(gapNum?: number) {
    if (!isEditing) setIsEditing(true);
    const el = textareaRef.current;
    const targetGap = gapNum ?? nextGapNumber;
    const blankTag = `{{blank:${targetGap}}}`;
    if (!el) {
      setDraft((prev) => (prev ? `${prev} ${blankTag}` : blankTag));
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    const newText = `${before}${blankTag}${after}`;
    setDraft(newText);
    requestAnimationFrame(() => {
      el.focus();
      const newPos = start + blankTag.length;
      el.setSelectionRange(newPos, newPos);
    });
  }

  function handleSave() {
    onSave(draft.trim());
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(`vh.passage.${part.id}`, draft.trim());
    }
    setIsEditing(false);
  }

  function handleCancel() {
    setDraft(saved);
    setIsEditing(false);
  }

  function handleDelete() {
    if (onDelete) {
      onDelete();
    } else {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem(`vh.passage.${part.id}`);
      }
      setDraft("");
      onSave("");
      setIsEditing(true);
    }
  }

  const isSavedState = saved.length > 0 && !isEditing;

  return (
    <section className="authoring-panel shared-passage-panel">
      <div className="panel-title">
        <div>
          {!["reading_1b", "reading_4"].includes(part.part_code) && <span className="phase-chip">{t.eyebrow}</span>}
          {!["reading_1b", "reading_4"].includes(part.part_code) && <h2>{t.heading(part.title)}</h2>}
          <p style={{ margin: "0" }}>{t.description}</p>
        </div>
      </div>

      {part.part_code === "reading_1b" && (
        <div className="question-authoring-help" style={{ marginTop: "10px", marginBottom: "14px" }}>
          <h4>How blanks work</h4>
          <p>
            Paste the full passage once, then click where you want each blank and press <strong>Insert Gap</strong> to place <code>{"{{blank:1}}"}</code>, <code>{"{{blank:2}}"}</code>, etc. Each gap gets its own 3 options below.
          </p>
        </div>
      )}

      {isClozePart && isEditable && isEditing && (
        <div className="vh-passage-blank-toolbar">
          <div className="vh-passage-blank-main-actions">
            <button
              type="button"
              className="vh-insert-blank-btn"
              onClick={() => insertBlank(nextGapNumber)}
              title="Click where you want the blank in the text, then click here to insert it."
            >
              <Icon name="plus" className="vh-btn-icon" style={{ width: "15px", height: "15px", strokeWidth: 2.5 }} />
              <span>Insert Gap {nextGapNumber <= limit ? `(${nextGapNumber})` : ""}</span>
            </button>
            <span className="vh-passage-blank-hint">
              Position cursor in the text and click <strong>Insert Gap</strong> (or click a gap pill below)
            </span>
          </div>

          <div className="vh-gap-pill-list" aria-label="Passage gaps status">
            {Array.from({ length: limit }, (_, i) => i + 1).map((gapNum) => {
              const present = existingGaps.has(gapNum);
              return (
                <button
                  key={gapNum}
                  type="button"
                  className={`vh-gap-pill ${present ? "is-present" : "is-missing"}`}
                  onClick={() => insertBlank(gapNum)}
                  title={present ? `Gap ${gapNum} is in passage. Click to insert another marker.` : `Click to insert Gap ${gapNum} at cursor`}
                >
                  {present ? (
                    <>
                      <Icon name="check" style={{ width: "12px", height: "12px", strokeWidth: 2.5 }} />
                      <span>Gap {gapNum}</span>
                    </>
                  ) : (
                    <>
                      <Icon name="plus" style={{ width: "12px", height: "12px", strokeWidth: 2.5 }} />
                      <span>Gap {gapNum}</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <textarea
        ref={textareaRef}
        className="shared-passage-input"
        rows={12}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={t.placeholder}
        readOnly={!isEditable || !isEditing}
        aria-label={t.heading(part.title)}
      />

      <div className="shared-passage-footer">
        {isEditable && (
          <>
            {isSavedState ? (
              <>
                <Button
                  variant="secondary"
                  size="md"
                  disabled={busy}
                  onClick={() => setIsEditing(true)}
                >
                  <Icon name="edit" style={{ width: "14px", height: "14px" }} />
                  Edit source text
                </Button>
                <Button
                  variant="danger"
                  size="md"
                  disabled={busy}
                  onClick={handleDelete}
                >
                  <Icon name="trash" style={{ width: "14px", height: "14px" }} />
                  Delete source text
                </Button>
              </>
            ) : (
              <>
                {saved.length > 0 && (
                  <Button
                    variant="secondary"
                    size="md"
                    disabled={busy}
                    onClick={handleCancel}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="md"
                  disabled={busy || !draft.trim() || (!dirty && !mismatched && saved.length > 0)}
                  onClick={handleSave}
                >
                  {busy ? t.saving : t.save}
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
