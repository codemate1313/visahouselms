import { useState, type DragEvent } from "react";
import type { AttemptQuestion, AttemptResponse } from "@/api/types";

import { renderRichText } from "@/components/ui";

interface MatchingQuestionGroupProps {
  questions: AttemptQuestion[];
  questionNumberOffset: number;
  savingIds: Set<number>;
  reusable: boolean;
  onChangeResponse: (questionId: number, response: AttemptResponse) => void;
}

export function MatchingQuestionGroup({
  questions,
  questionNumberOffset,
  savingIds,
  reusable,
  onChangeResponse,
}: MatchingQuestionGroupProps) {
  const options = questions[0]?.options ?? [];
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const selectedByQuestion = new Map(
    questions.map((question) => [question.id, typeof question.response?.selected === "string" ? question.response.selected : ""]),
  );
  const usedKeys = new Set([...selectedByQuestion.values()].filter(Boolean));

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

  const drop = (event: DragEvent<HTMLDivElement>, questionId: number) => {
    event.preventDefault();
    const key = event.dataTransfer.getData("text/plain");
    if (key) assign(questionId, key);
  };

  return (
    <div className="test-runner-matching" aria-label="Matching questions">
      <div className="test-runner-option-bank" aria-label="Answer options">
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

      <div className="test-runner-match-targets">
        {questions.map((question, index) => {
          const selected = selectedByQuestion.get(question.id) ?? "";
          return (
            <div
              className="test-runner-match-target"
              key={question.id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => drop(event, question.id)}
            >
              <div>
                <strong>Question {questionNumberOffset + index + 1}</strong>
                <p>{renderRichText(question.prompt)}</p>
              </div>
              <label>
                <span className="sr-only">Answer for question {questionNumberOffset + index + 1}</span>
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
                      {option.key}. {option.text}
                    </option>
                  ))}
                </select>
              </label>
              {pickedKey && <button type="button" onClick={() => assign(question.id, pickedKey)}>Place {pickedKey}</button>}
              {savingIds.has(question.id) && <small>Saving...</small>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
