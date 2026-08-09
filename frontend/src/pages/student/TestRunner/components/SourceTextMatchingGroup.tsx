import { useMemo, useState, type DragEvent } from "react";
import type { AttemptQuestion, AttemptResponse, QuestionOption } from "@/api/types";

interface SourceTextMatchingGroupProps {
  questions: AttemptQuestion[];
  questionNumberOffset: number;
  savingIds: Set<number>;
  reusable: boolean;
  mode: "source" | "targets";
  onChangeResponse: (questionId: number, response: AttemptResponse) => void;
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
}: SourceTextMatchingGroupProps) {
  const options = questions[0]?.options ?? [];
  const optionByKey = useMemo(() => new Map(options.map((option) => [option.key, option])), [options]);
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const selectedByQuestion = useMemo(
    () => new Map(
      questions.map((question) => [question.id, typeof question.response?.selected === "string" ? question.response.selected : ""]),
    ),
    [questions],
  );
  const usedKeys = useMemo(() => new Set([...selectedByQuestion.values()].filter(Boolean)), [selectedByQuestion]);

  const assign = (questionId: number, key: string) => {
    if (!reusable && key) {
      questions.forEach((question) => {
        if (question.id !== questionId && selectedByQuestion.get(question.id) === key) {
          onChangeResponse(question.id, { selected: "" });
        }
      });
    }
    onChangeResponse(questionId, { selected: key });
    setPickedKey(null);
  };

  const drop = (event: DragEvent<HTMLElement>, questionId: number) => {
    event.preventDefault();
    const key = event.dataTransfer.getData("text/plain");
    if (key) assign(questionId, key);
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

  return (
    <div className="test-runner-source-text-targets" aria-label="Matching targets">
      {questions.map((question, index) => {
        const selected = selectedByQuestion.get(question.id) ?? "";
        const questionNumber = questionNumberOffset + index + 1;
        const saving = savingIds.has(question.id);
        return (
          <article
            className="test-runner-source-text-target"
            key={question.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => drop(event, question.id)}
          >
            <div>
              <span>Question {questionNumber}</span>
              <p>{question.prompt}</p>
            </div>
            <label>
              <span className="sr-only">Answer for question {questionNumber}</span>
              <select
                value={selected}
                onChange={(event) => assign(question.id, event.target.value)}
              >
                <option value="">Drop or choose</option>
                {options.map((option) => (
                  <option
                    key={option.key}
                    value={option.key}
                    disabled={!reusable && usedKeys.has(option.key) && selected !== option.key}
                  >
                    {option.key}
                  </option>
                ))}
              </select>
            </label>
            {selected && (
              <button
                type="button"
                className="test-runner-source-text-clear"
                aria-label={`Clear answer for question ${questionNumber}`}
                onClick={() => assign(question.id, "")}
              >
                x
              </button>
            )}
            {pickedKey && (
              <button type="button" onClick={() => assign(question.id, pickedKey)}>
                Place {pickedKey}
              </button>
            )}
            {selected && <small>{optionLabel(optionByKey.get(selected), selected)}</small>}
            {saving && <em>Saving...</em>}
          </article>
        );
      })}
    </div>
  );
}
