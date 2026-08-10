import { useEffect, useMemo, useState } from "react";
import type { ExamModulePart } from "@/api/types";
import { Button, RequiredMark, SearchableSelect } from "@/components/ui";
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
export function GapTaskComposer({ part, isEditable, busy, onSubmit }: GapTaskComposerProps) {
  const t = strings.gapTask;
  const optionCount = part.answer_constraints.option_count ?? 8;
  const uniqueAnswers = Boolean(part.answer_constraints.unique_answers);
  const existing = part.questions;

  const [passage, setPassage] = useState("");
  const [options, setOptions] = useState<{ key: string; text: string }[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  /* Re-seed only when the saved task changes. Depending on the questions array
     itself re-ran this on every parent render - and the parent reloads after
     every save - which wiped a passage the author was still writing. */
  const savedSignature = existing
    .map((question) => `${question.id}:${(question.correct_answers ?? []).join("+")}`)
    .join("|");

  // Seed from whatever the part already holds so this edits rather than resets.
  useEffect(() => {
    const first = existing[0];
    setPassage(first?.passage ?? "");
    setOptions(
      first?.options?.length
        ? first.options.map((option) => ({ key: option.key, text: option.text }))
        : Array.from({ length: optionCount }, (_, index) => ({ key: LETTERS[index], text: "" })),
    );
    setAnswers(
      Object.fromEntries(
        existing.map((question, index) => [index + 1, question.correct_answers?.[0] ?? ""]),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [part.id, savedSignature, optionCount]);

  // The gaps are whatever the passage declares - the source of truth is the text.
  const gaps = useMemo(() => {
    const found: number[] = [];
    BLANK_MARKER.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = BLANK_MARKER.exec(passage)) !== null) found.push(Number(match[1]));
    return [...new Set(found)].sort((a, b) => a - b);
  }, [passage]);

  const expectedGaps = part.question_limit ?? gaps.length;
  const filledAnswers = gaps.filter((gap) => answers[gap]).length;
  const duplicateKeys = uniqueAnswers
    ? Object.values(answers).filter(Boolean).filter((key, index, all) => all.indexOf(key) !== index)
    : [];
  const filledOptions = options.filter((option) => option.text.trim());

  const problems: string[] = [];
  if (!passage.trim()) problems.push(t.errors.noPassage);
  if (gaps.length !== expectedGaps) problems.push(t.errors.gapCount(gaps.length, expectedGaps));
  if (gaps.some((gap, index) => gap !== index + 1)) problems.push(t.errors.gapSequence);
  if (filledOptions.length !== optionCount) problems.push(t.errors.optionCount(filledOptions.length, optionCount));
  if (filledAnswers !== gaps.length) problems.push(t.errors.missingAnswers(gaps.length - filledAnswers));
  if (duplicateKeys.length) problems.push(t.errors.duplicateAnswers);

  const ready = problems.length === 0;

  return (
    <section className="authoring-panel gap-task-composer">
      <div className="panel-title">
        <div>
          <span className="phase-chip">{t.eyebrow}</span>
          <h2>{t.heading(part.title)}</h2>
          <p>{t.description(expectedGaps, optionCount)}</p>
        </div>
      </div>

      <div className="question-authoring-help">
        <h4>{t.helpTitle}</h4>
        <p>{t.help}</p>
      </div>

      <label htmlFor="gap-task-passage">{t.passageLabel}<RequiredMark /></label>
      <textarea
        id="gap-task-passage"
        className="gap-task-passage"
        rows={12}
        value={passage}
        onChange={(event) => setPassage(event.target.value)}
        placeholder={t.passagePlaceholder}
        readOnly={!isEditable}
      />

      <h3 className="gap-task-subheading">{t.optionsHeading(optionCount)}</h3>
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
          </div>
        ))}
      </div>
      {isEditable && options.length < 26 && (
        <button
          type="button"
          className="option-add-button"
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
