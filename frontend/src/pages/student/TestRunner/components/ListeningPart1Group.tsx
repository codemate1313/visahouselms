import type { Attempt, AttemptResponse } from "@/api/types";

interface ListeningPart1GroupProps {
  currentPart: Attempt["parts"][number];
  questionNumberOffset: number;
  savingIds: Set<number>;
  onChangeResponse: (questionId: number, response: AttemptResponse) => void;
}

const DEFAULT_PART_1_INSTRUCTIONS =
  "You will hear some short conversations. You will hear each conversation twice. Choose the correct answer to complete each conversation.";

export function ListeningPart1Group({
  currentPart,
  questionNumberOffset,
  savingIds,
  onChangeResponse,
}: ListeningPart1GroupProps) {
  const instructions = currentPart.instructions || DEFAULT_PART_1_INSTRUCTIONS;

  return (
    <div className="lca-listening-part1-container">
      {/* Main Instruction Banner Box */}
      <div className="lca-listening-instruction-banner">
        <div className="lca-listening-instruction-badge" aria-hidden="true" />
        <div className="lca-listening-instruction-text">{instructions}</div>
      </div>

      {/* Stacked 7 Questions List */}
      <div className="lca-listening-questions-list">
        {currentPart.questions.map((question, qIdx) => {
          const displayNum = questionNumberOffset + qIdx + 1;
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
    </div>
  );
}
