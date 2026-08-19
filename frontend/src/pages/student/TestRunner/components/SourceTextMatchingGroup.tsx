import { useMemo, useState, type DragEvent } from "react";
import type { AttemptQuestion, AttemptResponse, QuestionOption } from "@/api/types";

import { renderRichText } from "@/components/ui";

interface SourceTextMatchingGroupProps {
  questions: AttemptQuestion[];
  questionNumberOffset: number;
  savingIds: Set<number>;
  reusable: boolean;
  mode: "source" | "targets";
  onChangeResponse: (questionId: number, response: AttemptResponse) => void;
  /** Final Test only: the exam paper accepts drag-and-drop, not a picker. */
  languageCertSkin?: boolean;
}

function optionLabel(option: QuestionOption | undefined, key: string) {
  return option ? `${option.key}. ${option.text}` : key;
}

export function SourceTextMatchingGroup({
  questions,
  questionNumberOffset,
  savingIds,
  reusable,
  mode,
  onChangeResponse,
  languageCertSkin = false,
}: SourceTextMatchingGroupProps) {
  const options = questions[0]?.options ?? [];
  const [pickedKey, setPickedKey] = useState<string | null>(null);

  /* A question is single-answer (`matching_reusable`, one text) or multi-answer
     (`mcq_multiple`, several texts at once). Both shapes live in the same part,
     so responses are normalised to a list here and written back in whichever
     shape the question's type expects. */
  const isMulti = (question: AttemptQuestion) => question.question_type === "mcq_multiple";

  const answersFor = (question: AttemptQuestion): string[] => {
    const selected = question.response?.selected;
    if (Array.isArray(selected)) return selected.filter((item): item is string => typeof item === "string" && item !== "");
    return typeof selected === "string" && selected ? [selected] : [];
  };

  const selectedByQuestion = useMemo(
    () => new Map(questions.map((question) => [question.id, answersFor(question)])),
    [questions],
  );
  const usedKeys = useMemo(
    () => new Set([...selectedByQuestion.values()].flat()),
    [selectedByQuestion],
  );

  const write = (question: AttemptQuestion, keys: string[]) => {
    onChangeResponse(question.id, isMulti(question) ? { selected: keys } : { selected: keys[0] ?? "" });
  };

  // Adds a text to a question. Multi-answer questions accumulate; single-answer
  // ones replace. A non-reusable part also clears the key from any other question.
  const assign = (question: AttemptQuestion, key: string) => {
    if (!reusable && key) {
      questions.forEach((other) => {
        if (other.id === question.id) return;
        const keys = selectedByQuestion.get(other.id) ?? [];
        if (keys.includes(key)) write(other, keys.filter((item) => item !== key));
      });
    }
    const current = selectedByQuestion.get(question.id) ?? [];
    if (!key) {
      write(question, []);
    } else if (isMulti(question)) {
      write(question, current.includes(key) ? current : [...current, key]);
    } else {
      write(question, [key]);
    }
    setPickedKey(null);
  };

  const removeKey = (question: AttemptQuestion, key: string) => {
    write(question, (selectedByQuestion.get(question.id) ?? []).filter((item) => item !== key));
  };

  const drop = (event: DragEvent<HTMLElement>, question: AttemptQuestion) => {
    event.preventDefault();
    const key = event.dataTransfer.getData("text/plain");
    if (key) assign(question, key);
  };

  if (mode === "source") {
    return (
      <div className="test-runner-source-text-options" aria-label="Source text options">
        {options.map((option) => {
          const unavailable = !reusable && usedKeys.has(option.key);
          return (
            <button
              type="button"
              key={option.key}
              className={pickedKey === option.key ? "is-picked" : ""}
              draggable={!unavailable}
              disabled={unavailable}
              onClick={() => setPickedKey((current) => current === option.key ? null : option.key)}
              onDragStart={(event) => event.dataTransfer.setData("text/plain", option.key)}
            >
              <strong>{option.key}</strong>
              <span>{option.text}</span>
            </button>
          );
        })}
      </div>
    );
  }

  /* Question on top, drop zone directly beneath it - the shape candidates meet
     in the real test. Outside the exam skin the <select> stays as the
     accessible control, styled to *be* the drop zone, so pointer, keyboard and
     touch all drive the same target rather than the drag being the only way
     in. The Final Test drops the picker (see below) and relies on drag plus
     the pick-then-place buttons. */
  return (
    <div className="test-runner-source-text-targets" aria-label="Matching targets">
      {questions.map((question, index) => {
        const selected = selectedByQuestion.get(question.id) ?? [];
        const questionNumber = questionNumberOffset + index + 1;
        const saving = savingIds.has(question.id);
        const multi = isMulti(question);
        const canAddMore = multi || selected.length === 0;
        return (
          <article
            className={`test-runner-source-text-target${selected.length ? " is-filled" : ""}`}
            key={question.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => drop(event, question)}
          >
            <p className="test-runner-source-text-prompt">{renderRichText(question.prompt)}</p>

            <div className="test-runner-source-text-slot">
              {selected.length > 0 && (
                <ul className="test-runner-source-text-chips">
                  {selected.map((key) => (
                    <li key={key}>
                      <span>{key}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${key} from question ${questionNumber}`}
                        onClick={() => removeKey(question, key)}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* The exam paper is drag-and-drop only. Offering the list of
                  texts as a picker beside the well turns a matching task into
                  a multiple-choice one - the candidate can read every option
                  from the well without ever going back to the passages. The
                  well stays a labelled drop target, and the pick-then-place
                  flow below still covers pointers that cannot drag. */}
              {canAddMore && !languageCertSkin && (
                <label className="test-runner-source-text-slot-control">
                  <span className="sr-only">
                    {multi ? `Add a text to question ${questionNumber}` : `Answer for question ${questionNumber}`}
                  </span>
                  <select
                    value=""
                    onChange={(event) => { if (event.target.value) assign(question, event.target.value); }}
                  >
                    <option value="">
                      {multi && selected.length > 0 ? "Drop another text here" : "Drop the correct text here"}
                    </option>
                    {options.map((option) => (
                      <option
                        key={option.key}
                        value={option.key}
                        disabled={
                          selected.includes(option.key)
                          || (!reusable && usedKeys.has(option.key))
                        }
                      >
                        {optionLabel(option, option.key)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {canAddMore && languageCertSkin && selected.length === 0 && (
                <span
                  className="test-runner-source-text-dropzone"
                  aria-label={`Drop the correct text here for question ${questionNumber}`}
                />
              )}

              {/* Tap flow: pick a text on the left, then place it here. */}
              {pickedKey && canAddMore && !selected.includes(pickedKey) && (
                <button
                  type="button"
                  className="test-runner-source-text-place"
                  onClick={() => assign(question, pickedKey)}
                >
                  Place {pickedKey}
                </button>
              )}
            </div>

            {saving && <em className="test-runner-source-text-saving">Saving...</em>}
          </article>
        );
      })}
    </div>
  );
}
