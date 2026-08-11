import type { Attempt, AttemptResponse } from "@/api/types";

interface ListeningChoiceGroupsProps {
  currentPart: Attempt["parts"][number];
  questionNumberOffset: number;
  savingIds: Set<number>;
  /** Listening 2 splits the same answer sheet into labelled conversations. */
  grouped?: boolean;
  onChangeResponse: (questionId: number, response: AttemptResponse) => void;
}

const DEFAULT_HEADING =
  "You will hear some short conversations. You will hear each conversation twice. Choose the correct answer to complete each conversation.";

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
 * Listening 1, 2 and 4 are the same sheet - a numbered card per question with
 * its options stacked underneath. Listening 2 is the only one that breaks the
 * run into labelled conversations, which is what `grouped` switches on.
 */
export function ListeningChoiceGroups({
  currentPart,
  questionNumberOffset,
  savingIds,
  grouped = false,
  onChangeResponse,
}: ListeningChoiceGroupsProps) {
  const heading = currentPart.instructions || DEFAULT_HEADING;
  const groups = grouped
    ? groupByConversation(currentPart.questions)
    : [{ label: "", questions: currentPart.questions }];
  let renderedIndex = 0;

  return (
    <div className="lca-listening-part1-container">
      {/* Main Instruction Banner Box */}
      <div className="lca-listening-instruction-banner">
        <div className="lca-listening-instruction-badge" aria-hidden="true" />
        <div className="lca-listening-instruction-text">{heading}</div>
      </div>

      {groups.map((group) => (
        <section className="lca-listening-group" key={group.label || "all"}>
          {group.label && <h3 className="lca-listening-group-label">{group.label}</h3>}
          <div className="lca-listening-questions-list">
            {group.questions.map((question) => {
              const displayNum = questionNumberOffset + renderedIndex + 1;
              renderedIndex += 1;
              const rawOptions = question.options || [];
              const optionsList = rawOptions.length > 0
                ? rawOptions
                : [{ key: "A", text: "Option A" }, { key: "B", text: "Option B" }, { key: "C", text: "Option C" }];

              const rawSelected = question.response?.selected;
              const selectedValue = Array.isArray(rawSelected) ? rawSelected[0] : (rawSelected || "");
              const isSaving = savingIds.has(question.id);

              return (
                <div
                  key={question.id}
                  className={`lca-listening-q-card${isSaving ? " is-saving" : ""}`}
                >
                  {/* Question Number Box */}
                  <div className="lca-listening-q-number">
                    {displayNum}
                  </div>

                  {/* Question Prompt (if available) */}
                  {question.prompt && (
                    <div className="lca-listening-q-prompt">
                      {question.prompt}
                    </div>
                  )}

                  {/* Choice Options List (A, B, C) */}
                  <div className="lca-listening-options">
                    {optionsList.map((opt, optIdx) => {
                      const letter = String.fromCharCode(65 + optIdx); // A, B, C...
                      const optionKey = opt.key || letter;
                      const optionText = opt.text || letter;
                      const isSelected = selectedValue === optionKey || selectedValue === letter || selectedValue === optionText;

                      return (
                        <button
                          key={`${question.id}-opt-${optIdx}`}
                          type="button"
                          className={`lca-option-row${isSelected ? " is-selected" : ""}`}
                          onClick={() => onChangeResponse(question.id, { selected: optionKey })}
                        >
                          <span className="lca-option-badge">{letter}</span>
                          <span className="lca-option-label">{optionText}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
