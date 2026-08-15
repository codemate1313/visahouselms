import { useMemo } from "react";
import type { AttemptQuestion, AttemptResponse } from "@/api/types";
import { parseClozeMarkers } from "@/utils/clozeMarkers";
import { testRunnerStrings as strings } from "../TestRunner.strings";

interface SharedClozeGroupProps {
  questions: AttemptQuestion[];
  questionNumberOffset: number;
  savingIds: Set<number>;
  mode?: "combined" | "source" | "options";
  onChangeResponse: (questionId: number, response: AttemptResponse) => void;
}

/**
 * Reading 1B ("shared_cloze"): one passage shared by every question in the
 * part, with `{{blank:N}}` markers linking gap N to the Nth question — each
 * gap has its own independent set of options (unlike inline_matching_blanks,
 * which shares one option pool across every blank).
 */
export function SharedClozeGroup({
  questions,
  questionNumberOffset,
  savingIds,
  mode = "combined",
  onChangeResponse,
}: SharedClozeGroupProps) {
  const t = strings.question;
  const sharedPassage = useMemo(
    () => questions.find((question) => question.passage?.trim())?.passage?.trim() ?? "",
    [questions],
  );
  const tokens = useMemo(() => parseClozeMarkers(sharedPassage), [sharedPassage]);

  const sourcePanel = (
    <article className="test-runner-passage test-runner-cloze-passage">
      <p>
        {tokens.map((token) => (
          token.type === "text"
            ? <span key={token.key}>{token.text}</span>
            : <strong key={token.key} className="test-runner-cloze-marker">({questionNumberOffset + token.gapNumber})</strong>
        ))}
      </p>
    </article>
  );

  const optionsPanel = (
    <div className="test-runner-cloze-options" aria-label="Gap answers">
      {questions.map((question, index) => {
        const selected = question.response?.selected;
        const saving = savingIds.has(question.id);
        return (
            <div className="test-runner-question test-runner-cloze-gap" key={question.id}>
              <div className="test-runner-question-head">
                <span className="test-runner-cloze-gap-number">{questionNumberOffset + index + 1}</span>
                {saving && <span className="hint">{t.saving}</span>}
              </div>
            <div className="test-runner-options">
              {question.options.map((option) => (
                <label key={option.key} className="test-runner-option">
                  <input
                    type="radio"
                    name={`cloze-gap-${question.id}`}
                    checked={selected === option.key}
                    onChange={() => onChangeResponse(question.id, { selected: option.key })}
                  />
                  {option.text}
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  if (mode === "source") return sourcePanel;
  if (mode === "options") return optionsPanel;

  return (
    <div className="test-runner-shared-cloze">
      {sourcePanel}
      {optionsPanel}
    </div>
  );
}
