import { useMemo } from "react";
import type { AttemptQuestion, AttemptResponse } from "@/api/types";

interface NotepadGapsGroupProps {
  questions: AttemptQuestion[];
  questionNumberOffset: number;
  savingIds: Set<number>;
  maxAnswerWords?: number;
  onChangeResponse: (questionId: number, response: AttemptResponse, debounce?: boolean) => void;
}

type LineToken =
  | { type: "text"; text: string; key: string }
  | { type: "blank"; question: AttemptQuestion; index: number; key: string };

const BLANK_MARKER = /\{\{blank:(\d+)\}\}/g;

/* Notepads authored before the composer existed have no passage of their own -
   each row carries only its line. Stitching those lines back together gives the
   same notepad, minus any context lines that were never captured. */
function buildFallbackNotepad(questions: AttemptQuestion[]) {
  return questions
    .map((question, index) => question.prompt.replace("{{blank}}", `{{blank:${index + 1}}}`))
    .join("\n");
}

function tokenize(line: string, questions: AttemptQuestion[], lineKey: string): LineToken[] {
  const tokens: LineToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  BLANK_MARKER.lastIndex = 0;
  while ((match = BLANK_MARKER.exec(line)) !== null) {
    const text = line.slice(lastIndex, match.index);
    if (text) tokens.push({ type: "text", text, key: `${lineKey}-text-${lastIndex}` });
    const blankIndex = Number(match[1]);
    const question = questions[blankIndex - 1];
    if (question) tokens.push({ type: "blank", question, index: blankIndex, key: `${lineKey}-blank-${question.id}` });
    lastIndex = match.index + match[0].length;
  }
  const tail = line.slice(lastIndex);
  if (tail) tokens.push({ type: "text", text: tail, key: `${lineKey}-text-${lastIndex}` });
  return tokens;
}

/**
 * One notepad, completed while the recording plays.
 *
 * Listening 3 is a single set of notes with numbered blanks, not a stack of
 * separate questions: the lines without a blank are the context that makes the
 * gapped ones answerable. Each blank is still its own scorable row, so answers
 * are saved per question exactly as they are anywhere else.
 */
export function NotepadGapsGroup({
  questions,
  questionNumberOffset,
  savingIds,
  maxAnswerWords,
  onChangeResponse,
}: NotepadGapsGroupProps) {
  const notepad = questions[0]?.passage?.trim() || buildFallbackNotepad(questions);
  const { heading, lines } = useMemo(() => {
    const allLines = notepad.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    // A first line with no blank in it is the notepad's title, as in the exam.
    const hasTitle = allLines.length > 1 && !allLines[0].includes("{{blank:");
    return {
      heading: hasTitle ? allLines[0] : null,
      lines: hasTitle ? allLines.slice(1) : allLines,
    };
  }, [notepad]);

  return (
    <article className="test-runner-notepad" aria-label="Notepad">
      <span className="test-runner-notepad-rings" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((ring) => <i key={ring} />)}
      </span>
      {heading && <h3 className="test-runner-notepad-heading">{heading}</h3>}
      <ul className="test-runner-notepad-lines">
        {lines.map((line, lineIndex) => (
          <li key={`line-${lineIndex}`}>
            {tokenize(line, questions, `line-${lineIndex}`).map((token) => {
              if (token.type === "text") return <span key={token.key}>{token.text}</span>;
              const value = token.question.response?.text ?? "";
              const words = value.trim().split(/\s+/).filter(Boolean).length;
              const overLimit = Boolean(maxAnswerWords && words > maxAnswerWords);
              const number = questionNumberOffset + token.index;
              return (
                <span className="test-runner-notepad-blank" key={token.key}>
                  <span className="test-runner-notepad-number">({number})</span>
                  <input
                    type="text"
                    className={`test-runner-text-input${overLimit ? " is-error" : ""}`}
                    value={value}
                    aria-label={`Answer for question ${number}`}
                    disabled={savingIds.has(token.question.id)}
                    onChange={(event) => onChangeResponse(token.question.id, { text: event.target.value }, true)}
                  />
                </span>
              );
            })}
          </li>
        ))}
      </ul>
    </article>
  );
}
