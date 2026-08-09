import type { RefObject } from "react";
import type { Attempt, AttemptResponse } from "@/api/types";
import { testRunnerStrings as strings } from "../TestRunner.strings";
import { QuestionInput } from "./QuestionInput";
import { MatchingQuestionGroup } from "./MatchingQuestionGroup";

interface QuestionPaneProps {
  currentPart: Attempt["parts"][number];
  questionPaneRef: RefObject<HTMLElement | null>;
  questionNumberOffset: number;
  savingIds: Set<number>;
  recordingQuestionId: number | null;
  onChangeResponse: (questionId: number, response: AttemptResponse, debounce?: boolean) => void;
  onRecord: (questionId: number) => void;
}

export function QuestionPane({
  currentPart,
  questionPaneRef,
  questionNumberOffset,
  savingIds,
  recordingQuestionId,
  onChangeResponse,
  onRecord,
}: QuestionPaneProps) {
  const t = strings.questionPane;
  const matchingType = currentPart.questions[0]?.question_type;
  const isMatchingPart = matchingType === "matching_unique" || matchingType === "matching_reusable";
  return (
    <section className="test-runner-question-pane" ref={questionPaneRef} aria-label={`${currentPart.title} questions`}>
      {currentPart.section_type !== "writing" && (
        <div className="test-runner-pane-heading test-runner-question-pane-heading">
          <span>
            {currentPart.question_count} {t.questionsSuffix}
          </span>
          <h2>{currentPart.title}</h2>
          <p>{t.instructions}</p>
        </div>
      )}
      {isMatchingPart ? (
        <MatchingQuestionGroup
          questions={currentPart.questions}
          questionNumberOffset={questionNumberOffset}
          savingIds={savingIds}
          reusable={matchingType === "matching_reusable"}
          onChangeResponse={(questionId, response) => onChangeResponse(questionId, response)}
        />
      ) : currentPart.questions.map((question, qIndex) => (
        <QuestionInput
          key={question.id}
          index={questionNumberOffset + qIndex + 1}
          question={question}
          hidePrompt={currentPart.section_type === "writing"}
          partInstructions={currentPart.section_type === "writing" ? currentPart.instructions : null}
          saving={savingIds.has(question.id)}
          recording={recordingQuestionId === question.id}
          onChange={(response, debounce) => onChangeResponse(question.id, response, debounce)}
          onRecord={() => onRecord(question.id)}
        />
      ))}
    </section>
  );
}
