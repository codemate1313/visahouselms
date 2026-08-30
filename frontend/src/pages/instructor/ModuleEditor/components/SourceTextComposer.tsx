import { useEffect, useState } from "react";
import type { ExamModulePart } from "@/api/types";
import { Button, RequiredMark, RichTextEditor } from "@/components/ui";
import { IconButton } from "@/components/ui/IconButton/IconButton";
import { Icon } from "@/components/icons";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";

export interface SourceTextDraft {
  texts: { key: string; text: string }[];
  questions: { prompt: string; answers: string[] }[];
}

interface SourceTextComposerProps {
  part: ExamModulePart;
  isEditable: boolean;
  busy: boolean;
  onSubmit: (draft: SourceTextDraft) => void;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Source-text matching authored as one task.
 *
 * The candidate sees N source texts on the left and M statements on the right,
 * and drags a text onto each statement. Those texts ARE the option bank, so
 * they get one box each here rather than being pasted as a single blob and then
 * re-typed as options.
 *
 * A statement usually takes one text, and a text may answer several statements.
 * Selecting two or more texts for a statement makes it a multi-answer item -
 * which is marked on an exact set match, so it is opt-in per statement rather
 * than the default.
 */
export function SourceTextComposer({ part, isEditable, busy, onSubmit }: SourceTextComposerProps) {
  const t = strings.sourceTextTask;
  const textCount = part.answer_constraints.option_count ?? 4;
  const questionCount = part.question_limit ?? part.minimum_questions ?? 7;
  /* Multi-answer needs `mcq_multiple` to be a permitted type for the part,
     because that is what a multi-key statement is saved as. The explicit flag
     is the intent; the allowed-types list is what validation actually enforces,
     so either one enables it and a part missing both stays single-answer
     rather than letting an author build statements that cannot be saved. */
  const multiAllowed = Boolean(
    part.answer_constraints.multi_answer_allowed
    || part.answer_constraints.allowed_question_types?.includes("mcq_multiple"),
  );
  const existing = part.questions;

  const [texts, setTexts] = useState<{ key: string; text: string }[]>([]);
  const [questions, setQuestions] = useState<{ prompt: string; answers: string[] }[]>([]);

  /* Re-seed only when the saved content actually changes. Depending on the
     questions array itself re-ran this on every parent render and wiped
     whatever the author had typed but not yet saved. */
  const savedSignature = existing
    .map((question) => `${question.id}:${question.prompt}:${(question.correct_answers ?? []).join("+")}`)
    .join("|");

  useEffect(() => {
    const first = existing[0];
    setTexts(
      first?.options?.length
        ? first.options.map((option) => ({ key: option.key, text: option.text }))
        : Array.from({ length: textCount }, (_, index) => ({ key: LETTERS[index], text: "" })),
    );
    setQuestions(
      existing.length
        ? existing.map((question) => ({
            prompt: question.prompt,
            answers: [...(question.correct_answers ?? [])],
          }))
        : Array.from({ length: questionCount }, () => ({ prompt: "", answers: [] })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [part.id, savedSignature, textCount, questionCount]);

  const filledTexts = texts.filter((item) => item.text.trim());
  const filledQuestions = questions.filter((item) => item.prompt.trim());
  const unanswered = questions.filter((item) => item.prompt.trim() && item.answers.length === 0).length;

  const problems: string[] = [];
  if (filledTexts.length !== textCount) problems.push(t.errors.textCount(filledTexts.length, textCount));
  if (filledQuestions.length !== questionCount) problems.push(t.errors.questionCount(filledQuestions.length, questionCount));
  if (unanswered) problems.push(t.errors.missingAnswers(unanswered));

  const ready = problems.length === 0;

  const toggleAnswer = (index: number, key: string) => {
    setQuestions(questions.map((question, current) => {
      if (current !== index) return question;
      const has = question.answers.includes(key);
      if (has) return { ...question, answers: question.answers.filter((item) => item !== key) };
      return { ...question, answers: multiAllowed ? [...question.answers, key] : [key] };
    }));
  };

  return (
    <section className="authoring-panel source-text-composer">
      <div className="panel-title">
        <div>
          {part.part_code !== "reading_3" && <span className="phase-chip">{t.eyebrow}</span>}
          <h2>{t.heading(part.title)}</h2>
          <p>{t.description(textCount, questionCount)}</p>
        </div>
      </div>

      <div className="question-authoring-help">
        <h4>{t.helpTitle}</h4>
        <p>{multiAllowed ? t.helpMulti : t.help}</p>
        {/* Without this, an author clicking a second letter and seeing the
            first one clear has no way to know why. */}
        {!multiAllowed && <p className="source-text-multi-blocked">{t.multiUnavailable}</p>}
      </div>

      <h3 className="gap-task-subheading">{t.textsHeading(textCount)}<RequiredMark /></h3>
      <div className="source-text-list">
        {texts.map((item, index) => (
          <div className="source-text-item" key={item.key}>
            <span className="gap-task-option-key">{item.key}</span>
            <RichTextEditor
              rows={5}
              value={item.text}
              onChange={(next) =>
                setTexts(texts.map((entry, current) =>
                  current === index ? { ...entry, text: next } : entry))
              }
              placeholder={t.textPlaceholder(item.key)}
              readOnly={!isEditable}
              aria-label={t.textPlaceholder(item.key)}
            />
          </div>
        ))}
      </div>
      {isEditable && texts.length < 26 && (
        <Button
          type="button"
          className="option-add-button"
          onClick={() => setTexts([...texts, { key: LETTERS[texts.length], text: "" }])}
        >
          <Icon name="plus" />
          {t.addText}
        </Button>
      )}

      <h3 className="gap-task-subheading">{t.questionsHeading(questionCount)}<RequiredMark /></h3>
      <div className="source-text-questions">
        {questions.map((question, index) => (
          <div className="source-text-question" key={index}>
            <div className="source-text-question-head">
              <span className="gap-task-gap-label">{t.questionLabel(index + 1)}</span>
              {isEditable && questions.length > 1 && (
                <IconButton
                  className="option-remove-button"
                  label={t.removeQuestion(index + 1)}
                  onClick={() => setQuestions(questions.filter((_, current) => current !== index))}
                  icon={<Icon name="cross" />}
                />
              )}
            </div>
            <input
              value={question.prompt}
              onChange={(event) =>
                setQuestions(questions.map((entry, current) =>
                  current === index ? { ...entry, prompt: event.target.value } : entry))
              }
              placeholder={t.questionPlaceholder}
              readOnly={!isEditable}
            />
            <div className="source-text-answer-picker" role="group" aria-label={t.answerFor(index + 1)}>
              {texts.map((item) => (
                <button
                  type="button"
                  key={item.key}
                  className={question.answers.includes(item.key) ? "is-selected" : ""}
                  disabled={!isEditable || !item.text.trim()}
                  aria-pressed={question.answers.includes(item.key)}
                  onClick={() => toggleAnswer(index, item.key)}
                >
                  {item.key}
                </button>
              ))}
              {multiAllowed && question.answers.length > 1 && (
                <span className="source-text-multi-note">{t.multiNote}</span>
              )}
            </div>
          </div>
        ))}
      </div>
      {isEditable && (
        <Button
          type="button"
          className="option-add-button"
          onClick={() => setQuestions([...questions, { prompt: "", answers: [] }])}
        >
          <Icon name="plus" />
          {t.addQuestion}
        </Button>
      )}

      {problems.length > 0 && (
        <ul className="gap-task-problems">
          {problems.map((problem) => <li key={problem}>{problem}</li>)}
        </ul>
      )}

      {isEditable && (
        <div className="gap-task-footer">
          <span className="gap-task-status">
            {existing.length > 0 ? t.replaceNotice(existing.length) : t.createNotice(filledQuestions.length)}
          </span>
          <Button
            variant="primary"
            disabled={busy || !ready}
            onClick={() => onSubmit({ texts: filledTexts, questions: filledQuestions })}
          >
            {busy ? t.saving : existing.length > 0 ? t.replace : t.create}
          </Button>
        </div>
      )}
    </section>
  );
}
