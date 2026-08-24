import { useEffect, useMemo, useRef, useState } from "react";
import type { ExamModulePart } from "@/api/types";
import { Button, RequiredMark, RichTextEditor, SearchableSelect } from "@/components/ui";
import { Icon } from "@/components/icons";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";

export interface GapTaskDraft {
  passage: string;
  options: { key: string; text: string }[];
  answers: Record<number, string>;
}

interface GapTaskComposerProps {
  part: ExamModulePart;
  isEditable: boolean;
  busy: boolean;
  onSubmit: (draft: GapTaskDraft) => void;
  onSavePassage?: (passage: string) => void;
  onDeletePassage?: () => void;
}

const BLANK_MARKER = /\{\{blank:(\d+)\}\}/g;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * One gapped passage authored as one task.
 *
 * A gap-matching part is a single piece of source material with N gaps, worth
 * one mark per gap. The data model stores that as N question rows so each gap
 * scores independently - but asking an author to create N rows by hand, each
 * carrying its own copy of the passage and the whole option bank, invites the
 * mistake of writing the entire task as a single question worth one mark.
 *
 * So the task is composed here as the candidate sees it, and the rows are
 * generated from it on save.
 */
export function GapTaskComposer({
  part,
  isEditable,
  busy,
  onSubmit,
  onSavePassage,
  onDeletePassage,
}: GapTaskComposerProps) {
  const t = strings.gapTask;
  const optionCount = part.answer_constraints.option_count ?? 8;
  const uniqueAnswers = Boolean(part.answer_constraints.unique_answers);
  const existing = part.questions;

  const storedPassage = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(`vh.passage.${part.id}`) || "" : "";
  const first = existing[0];
  const savedPassage = (first?.passage ?? storedPassage).trim();

  const [passage, setPassage] = useState(savedPassage);
  const [isEditingPassage, setIsEditingPassage] = useState(savedPassage.length === 0);
  const [options, setOptions] = useState<{ key: string; text: string }[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  /* Re-seed only when the saved task changes. Depending on the questions array
     itself re-ran this on every parent render - and the parent reloads after
     every save - which wiped a passage the author was still writing. */
  const savedSignature = existing
    .map((question) => `${question.id}:${(question.correct_answers ?? []).join("+")}:${question.passage ?? ""}:${JSON.stringify(question.options ?? [])}`)
    .join("|");

  // Seed from whatever the part already holds so this edits rather than resets.
  useEffect(() => {
    const currentStored = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(`vh.passage.${part.id}`) || "" : "";
    const effectivePassage = (first?.passage ?? currentStored).trim();
    setPassage(effectivePassage);
    setIsEditingPassage(effectivePassage.length === 0);
    setOptions(
      first?.options?.length
        ? first.options.map((option) => ({
            key: option.key,
            text: option.text ?? "",
          }))
        : Array.from({ length: optionCount }, (_, index) => ({ key: LETTERS[index], text: "" })),
    );
    setAnswers(
      Object.fromEntries(
        existing.map((question, index) => {
          const match = question.prompt?.match(/\d+/);
          const gapNum = match ? Number(match[0]) : index + 1;
          return [gapNum, question.correct_answers?.[0] ?? ""];
        }),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [part.id, savedSignature, optionCount]);

  useEffect(() => {
    if (savedPassage.length > 0) {
      setPassage((current) => current.trim() ? current : savedPassage);
    }
  }, [savedPassage]);

  // The gaps are whatever the passage declares - the source of truth is the text.
  const gaps = useMemo(() => {
    const found: number[] = [];
    BLANK_MARKER.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = BLANK_MARKER.exec(passage)) !== null) found.push(Number(match[1]));
    return [...new Set(found)].sort((a, b) => a - b);
  }, [passage]);

  const filledAnswers = gaps.filter((gap) => answers[gap]).length;
  const duplicateKeys = uniqueAnswers
    ? Object.values(answers).filter(Boolean).filter((key, index, all) => all.indexOf(key) !== index)
    : [];
  const filledOptions = options.filter((option) => option.text.trim());
  const minOptionsRequired = gaps.length + 2;

  const problems: string[] = [];
  if (!passage.trim()) problems.push(t.errors.noPassage);
  if (gaps.length === 0) problems.push("Add at least 1 gap marker (e.g. {{blank:1}}) in the passage text.");
  if (gaps.some((gap, index) => gap !== index + 1)) problems.push(t.errors.gapSequence);
  if (filledOptions.length < minOptionsRequired) {
    problems.push(
      `Number of options (${filledOptions.length}) must be at least 2 greater than number of gaps (${gaps.length}). Please add at least ${minOptionsRequired - filledOptions.length} more option(s).`
    );
  }
  if (options.some((opt) => !opt.text.trim())) {
    problems.push("Please fill in option text for all option fields (or delete unused option rows).");
  }
  if (filledAnswers !== gaps.length) problems.push(t.errors.missingAnswers(gaps.length - filledAnswers));
  if (duplicateKeys.length) problems.push(t.errors.duplicateAnswers);

  const ready = problems.length === 0;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const existingGaps = useMemo(() => new Set(gaps), [gaps]);
  const maxGapNum = gaps.length > 0 ? Math.max(...gaps) : 0;
  const nextGapNumber = maxGapNum + 1;

  function insertBlank(gapNum?: number) {
    if (!isEditingPassage) setIsEditingPassage(true);
    const el = textareaRef.current;
    const targetGap = gapNum ?? nextGapNumber;
    const blankTag = `{{blank:${targetGap}}}`;
    if (!el) {
      setPassage((prev) => (prev ? `${prev} ${blankTag}` : blankTag));
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    const newText = `${before}${blankTag}${after}`;
    setPassage(newText);
    requestAnimationFrame(() => {
      el.focus();
      const newPos = start + blankTag.length;
      el.setSelectionRange(newPos, newPos);
    });
  }

  function handleDeleteOption(indexToRemove: number) {
    const removedKey = options[indexToRemove]?.key;
    const filtered = options.filter((_, idx) => idx !== indexToRemove);
    const rekeyed = filtered.map((opt, idx) => ({
      ...opt,
      key: LETTERS[idx],
    }));
    setOptions(rekeyed);

    if (removedKey) {
      setAnswers((prev) => {
        const next: Record<number, string> = {};
        for (const [gapStr, val] of Object.entries(prev)) {
          if (val !== removedKey) {
            next[Number(gapStr)] = val;
          }
        }
        return next;
      });
    }
  }

  function handleSavePassage() {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(`vh.passage.${part.id}`, passage.trim());
    }
    if (onSavePassage) {
      onSavePassage(passage.trim());
    }
    setIsEditingPassage(false);
  }

  function handleCancelPassage() {
    setPassage(savedPassage);
    setIsEditingPassage(false);
  }

  function handleDeletePassage() {
    if (onDeletePassage) {
      onDeletePassage();
    } else {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem(`vh.passage.${part.id}`);
      }
      setPassage("");
      if (onSavePassage) onSavePassage("");
      setIsEditingPassage(true);
    }
  }

  const isSavedState = savedPassage.length > 0 && !isEditingPassage;

  return (
    <section className="authoring-panel gap-task-composer">
      <div className="panel-title">
        <div>
          {part.part_code !== "reading_2" && <span className="phase-chip">{t.eyebrow}</span>}
          {part.part_code !== "reading_2" && <h2>{t.heading(part.title)}</h2>}
          <p style={{ margin: "0" }}>{t.description(gaps.length, options.length)}</p>
        </div>
      </div>

      <div className="question-authoring-help">
        <h4>{t.helpTitle}</h4>
        <p>{t.help}</p>
      </div>

      {isEditable && isEditingPassage && (
        <div className="vh-passage-blank-toolbar" style={{ marginTop: "12px", marginBottom: "14px" }}>
          <div className="vh-passage-blank-main-actions">
            <button
              type="button"
              className="vh-insert-blank-btn"
              onClick={() => insertBlank(nextGapNumber)}
              title="Click where you want the blank in the text, then click here to insert it."
            >
              <Icon name="plus" className="vh-btn-icon" style={{ width: "15px", height: "15px", strokeWidth: 2.5 }} />
              <span>Insert Gap ({nextGapNumber})</span>
            </button>
            <span className="vh-passage-blank-hint">
              Position cursor in the text and click <strong>Insert Gap</strong> (or click a gap pill below)
            </span>
          </div>

          <div className="vh-gap-pill-list" aria-label="Passage gaps status">
            {Array.from({ length: Math.max(gaps.length, 1) }, (_, i) => i + 1).map((gapNum) => {
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

      <label htmlFor="gap-task-passage">{t.passageLabel}<RequiredMark /></label>
      <RichTextEditor
        ref={textareaRef}
        id="gap-task-passage"
        className="gap-task-passage"
        rows={12}
        value={passage}
        onChange={setPassage}
        placeholder={t.passagePlaceholder}
        readOnly={!isEditable || !isEditingPassage}
      />

      <div className="shared-passage-footer" style={{ marginBottom: "20px" }}>
        {isEditable && (
          <>
            {isSavedState ? (
              <>
                <Button
                  variant="secondary"
                  size="md"
                  disabled={busy}
                  onClick={() => setIsEditingPassage(true)}
                >
                  <Icon name="edit" style={{ width: "14px", height: "14px" }} />
                  Edit source text
                </Button>
                <Button
                  variant="danger"
                  size="md"
                  disabled={busy}
                  onClick={handleDeletePassage}
                >
                  <Icon name="trash" style={{ width: "14px", height: "14px" }} />
                  Delete source text
                </Button>
              </>
            ) : (
              <>
                {savedPassage.length > 0 && (
                  <Button
                    variant="secondary"
                    size="md"
                    disabled={busy}
                    onClick={handleCancelPassage}
                  >
                    Cancel
                  </Button>
                )}
                {onSavePassage && (
                  <Button
                    variant="primary"
                    size="md"
                    disabled={busy || !passage.trim() || (passage.trim() === savedPassage && savedPassage.length > 0)}
                    onClick={handleSavePassage}
                  >
                    {busy ? strings.sharedPassage.saving : strings.sharedPassage.save}
                  </Button>
                )}
              </>
            )}
          </>
        )}
      </div>

      <h3 className="gap-task-subheading">{t.optionsHeading(options.length)}</h3>
      <div className="gap-task-options">
        {options.map((option, index) => (
          <div className="gap-task-option-row" key={option.key}>
            <span className="gap-task-option-key">{option.key}</span>
            <input
              value={option.text}
              onChange={(event) =>
                setOptions(options.map((item, current) =>
                  current === index ? { ...item, text: event.target.value } : item))
              }
              placeholder={t.optionPlaceholder(option.key)}
              readOnly={!isEditable}
            />
            {isEditable && options.length > 2 && (
              <button
                type="button"
                className="option-remove-button"
                onClick={() => handleDeleteOption(index)}
                title={`Delete option ${option.key}`}
                aria-label={`Delete option ${option.key}`}
              >
                <Icon name="cross" />
              </button>
            )}
          </div>
        ))}
      </div>
      {isEditable && options.length < 26 && (
        <button
          type="button"
          className="option-add-button"
          style={{ marginTop: "10px" }}
          onClick={() => setOptions([...options, { key: LETTERS[options.length], text: "" }])}
        >
          <Icon name="plus" />
          {t.addOption}
        </button>
      )}

      <h3 className="gap-task-subheading">{t.answersHeading}</h3>
      {gaps.length === 0 ? (
        <p className="gap-task-empty">{t.noGaps}</p>
      ) : (
        <div className="gap-task-answers">
          {gaps.map((gap) => (
            <div className="gap-task-answer-row" key={gap}>
              <span className="gap-task-gap-label">{t.gapLabel(gap)}</span>
              <SearchableSelect
                ariaLabel={t.gapLabel(gap)}
                options={filledOptions.map((option) => ({
                  value: option.key,
                  label: `${option.key}. ${option.text}`,
                }))}
                value={answers[gap] ?? ""}
                onChange={(value) => setAnswers({ ...answers, [gap]: String(value) })}
                searchable={false}
                className="form-dropdown-select"
              />
            </div>
          ))}
        </div>
      )}

      {problems.length > 0 && (
        <ul className="gap-task-problems">
          {problems.map((problem) => <li key={problem}>{problem}</li>)}
        </ul>
      )}

      {isEditable && (
        <div className="gap-task-footer">
          <span className="gap-task-status">
            {existing.length > 0 ? t.replaceNotice(existing.length) : t.createNotice(gaps.length)}
          </span>
          <Button
            variant="primary"
            disabled={busy || !ready}
            onClick={() => onSubmit({ passage, options: filledOptions, answers })}
          >
            {busy ? t.saving : existing.length > 0 ? t.replace(gaps.length) : t.create(gaps.length)}
          </Button>
        </div>
      )}
    </section>
  );
}
