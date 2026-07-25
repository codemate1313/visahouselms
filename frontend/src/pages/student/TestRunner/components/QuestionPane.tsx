import type { RefObject } from "react";
import type { Attempt, AttemptResponse } from "@/api/types";
import { testRunnerStrings as strings } from "../TestRunner.strings";
import { QuestionInput } from "./QuestionInput";

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
  return (
    <section className="test-runner-question-pane" ref={questionPaneRef} aria-label={`${currentPart.title} questions`}>
      <div className="test-runner-pane-heading test-runner-question-pane-heading">
        <span>
          {currentPart.question_count} {t.questionsSuffix}
        </span>
        <h2>{currentPart.title}</h2>
        <p>{t.instructions}</p>
      </div>
      {currentPart.questions.map((question, qIndex) => (
        <QuestionInput
          key={question.id}
          index={questionNumberOffset + qIndex + 1}
          question={question}
          saving={savingIds.has(question.id)}
          recording={recordingQuestionId === question.id}
          onChange={(response, debounce) => onChangeResponse(question.id, response, debounce)}
          onRecord={() => onRecord(question.id)}
        />
      ))}
    </section>
  );
}
