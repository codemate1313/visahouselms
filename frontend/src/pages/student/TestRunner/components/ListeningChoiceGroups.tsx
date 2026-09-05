import type { Attempt, AttemptQuestion, AttemptResponse } from "@/api/types";
import { QuestionInput } from "./QuestionInput";

interface ListeningChoiceGroupsProps {
  currentPart: Attempt["parts"][number];
  questionNumberOffset: number;
  savingIds: Set<number>;
  /** Listening 2 splits the same answer sheet into labelled conversations. */
  grouped?: boolean;
  onChangeResponse: (questionId: number, response: AttemptResponse, debounce?: boolean) => void;
  /** Final Test only: forwarded so the answer sheet renders in the exam skin. */
  languageCertSkin?: boolean;
}

const DEFAULT_HEADING =
  "You will hear some short conversations. You will hear each conversation twice. Choose the correct answer to complete each conversation.";

const PLACEHOLDER_OPTIONS = [
  { key: "A", text: "Option A" },
  { key: "B", text: "Option B" },
  { key: "C", text: "Option C" },
];

type QuestionRow = Attempt["parts"][number]["questions"][number];

/** Consecutive questions carrying the same conversation label form one block,
 *  in the order the author saved them. */
function groupByConversation(questions: QuestionRow[]) {
  return questions.reduce<Array<{ label: string; questions: QuestionRow[] }>>((groups, question) => {
    const label = question.interaction?.group_label?.trim() || "Conversation";
    const current = groups[groups.length - 1];
    if (!current || current.label !== label) groups.push({ label, questions: [question] });
    else current.questions.push(question);
    return groups;
  }, []);
}

/**
 * The multiple-choice listening answer sheet.
 *
 * Listening 1, 2 and 4 are the same paper, so they are drawn by the same
 * component: every question here goes through `QuestionInput`, exactly as
 * Listening 4 does when it falls through to the default renderer. That is
 * deliberate - the two used to carry their own `.lca-listening-q-card` /
 * `.lca-option-row` markup kept in visual step with the question strip by a
 * parallel set of rules, and the two sets drifted. One element tree means one
 * set of rules, so the numbered strip, the lettered cells and the selected
 * tint cannot come out looking different between the parts again.
 *
 * The wrappers around the questions are all that stay part-specific: the
 * instruction band, and the labelled conversation blocks Listening 2 splits
 * its sheet into, which is what `grouped` switches on.
 */
export function ListeningChoiceGroups({
  currentPart,
  questionNumberOffset,
  savingIds,
  grouped = false,
  onChangeResponse,
  languageCertSkin = false,
}: ListeningChoiceGroupsProps) {
  const heading = currentPart.instructions || DEFAULT_HEADING;
  const groups = grouped
    ? groupByConversation(currentPart.questions)
    : [{ label: "", questions: currentPart.questions }];
  /* Listening 1's stems live in the audio, not on the page - the exam client
     shows the bare number there. Blanking the prompt keeps the strip's second
     cell empty without giving the part a layout of its own. */
  const hidesPrompt = currentPart.part_code === "listening_1";
  let renderedIndex = 0;

  return (
    <div className="lca-listening-part1-container">
      {/* Main Instruction Banner Box */}
      <div className="lca-listening-instruction-banner">
        <div className="lca-listening-instruction-badge">L</div>
        <div className="lca-listening-instruction-text">{heading}</div>
      </div>

      {groups.map((group) => (
        <section className="lca-listening-group" key={group.label || "all"}>
          {group.label && <h3 className="lca-listening-group-label">{group.label}</h3>}
          <div className="lca-listening-questions-list">
            {group.questions.map((question) => {
              const displayNum = questionNumberOffset + renderedIndex + 1;
              renderedIndex += 1;
              const sheetQuestion: AttemptQuestion = {
                ...question,
                question_type: "mcq_single",
                prompt: hidesPrompt ? "" : question.prompt,
                options: question.options?.length ? question.options : PLACEHOLDER_OPTIONS,
              };

              return (
                <QuestionInput
                  key={question.id}
                  index={displayNum}
                  question={sheetQuestion}
                  saving={savingIds.has(question.id)}
                  recording={false}
                  languageCertSkin={languageCertSkin}
                  /* Forward the debounce flag: typed answers ask to be saved
                     on a pause, and dropping it here fired one PUT per
                     keystroke. */
                  onChange={(response, debounce) => onChangeResponse(question.id, response, debounce)}
                  onRecord={() => {}}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
