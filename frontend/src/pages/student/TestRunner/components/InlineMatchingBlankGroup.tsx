import { useMemo, useState, type DragEvent } from "react";
import type { AttemptQuestion, AttemptResponse, QuestionOption } from "@/api/types";
import { renderRichText } from "@/components/ui";

interface InlineMatchingBlankGroupProps {
  questions: AttemptQuestion[];
  questionNumberOffset: number;
  savingIds: Set<number>;
  reusable: boolean;
  mode?: "combined" | "source" | "options";
  onChangeResponse: (questionId: number, response: AttemptResponse) => void;
}

type PassageToken =
  | { type: "text"; text: string; key: string }
  | { type: "blank"; question: AttemptQuestion; index: number; key: string };

const BLANK_MARKER = /\{\{blank:(\d+)\}\}/g;

function optionLabel(option: QuestionOption | undefined, key: string) {
  return option ? `${option.key}. ${option.text}` : key;
}

function buildFallbackPassage(questions: AttemptQuestion[]) {
  return questions
    .map((question, index) => `${question.prompt} {{blank:${index + 1}}}`)
    .join(" ");
}

export function InlineMatchingBlankGroup({
  questions,
  questionNumberOffset,
  savingIds,
  reusable,
  mode = "combined",
  onChangeResponse,
}: InlineMatchingBlankGroupProps) {
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
  const sourcePassage = questions[0]?.passage?.trim() || buildFallbackPassage(questions);

  const tokens = useMemo<PassageToken[]>(() => {
    const parsed: PassageToken[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    BLANK_MARKER.lastIndex = 0;
    while ((match = BLANK_MARKER.exec(sourcePassage)) !== null) {
      const text = sourcePassage.slice(lastIndex, match.index);
      if (text) parsed.push({ type: "text", text, key: `text-${lastIndex}` });
      const blankIndex = Number(match[1]);
      const question = questions[blankIndex - 1];
      if (question) parsed.push({ type: "blank", question, index: blankIndex, key: `blank-${question.id}` });
      lastIndex = match.index + match[0].length;
    }
    const tail = sourcePassage.slice(lastIndex);
    if (tail) parsed.push({ type: "text", text: tail, key: `text-${lastIndex}` });
    return parsed;
  }, [questions, sourcePassage]);

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

  const placePicked = (questionId: number) => {
    if (pickedKey) assign(questionId, pickedKey);
  };

  const sourcePanel = (
      <article className="test-runner-inline-passage">
        <p>
          {tokens.map((token) => {
            if (token.type === "text") return <span key={token.key}>{renderRichText(token.text)}</span>;
            const selected = selectedByQuestion.get(token.question.id) ?? "";
            const saving = savingIds.has(token.question.id);
            return (
              <span
                key={token.key}
                role="button"
                tabIndex={0}
                className={`test-runner-inline-blank${selected ? " is-filled" : ""}${saving ? " is-saving" : ""}`}
                onClick={() => placePicked(token.question.id)}
                onKeyDown={(event) => {
                  if ((event.key === "Enter" || event.key === " ") && pickedKey) {
                    event.preventDefault();
                    placePicked(token.question.id);
                  }
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => drop(event, token.question.id)}
                aria-label={`Answer for question ${questionNumberOffset + token.index}`}
              >
                <span>{selected ? optionLabel(optionByKey.get(selected), selected) : `Question ${questionNumberOffset + token.index}`}</span>
                {selected && (
                  <button
                    type="button"
                    className="test-runner-inline-blank-clear"
                    aria-label={`Clear answer for question ${questionNumberOffset + token.index}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      assign(token.question.id, "");
                    }}
                  >
                    x
                  </button>
                )}
              </span>
            );
          })}
        </p>
      </article>
  );

  const optionPanel = (
      <aside className="test-runner-inline-options" aria-label="Answer options">
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
      </aside>
  );

  if (mode === "source") return sourcePanel;
  if (mode === "options") return optionPanel;

  return (
    <div className="test-runner-inline-matching" aria-label="Inline matching blanks">
      {sourcePanel}
      {optionPanel}
    </div>
  );
}
