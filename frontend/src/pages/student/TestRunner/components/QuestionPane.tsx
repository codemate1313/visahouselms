import type { RefObject } from "react";
import type { Attempt, AttemptResponse } from "@/api/types";
import { testRunnerStrings as strings } from "../TestRunner.strings";
import { QuestionInput } from "./QuestionInput";
import { MatchingQuestionGroup } from "./MatchingQuestionGroup";
import { InlineMatchingBlankGroup } from "./InlineMatchingBlankGroup";
import { SourceTextMatchingGroup } from "./SourceTextMatchingGroup";
import { SharedClozeGroup } from "./SharedClozeGroup";
import { ListeningChoiceGroups } from "./ListeningChoiceGroups";
import { NotepadGapsGroup } from "./NotepadGapsGroup";

interface QuestionPaneProps {
  currentPart: Attempt["parts"][number];
  questionPaneRef: RefObject<HTMLElement | null>;
  questionNumberOffset: number;
  savingIds: Set<number>;
  recordingQuestionId: number | null;
  onChangeResponse: (questionId: number, response: AttemptResponse, debounce?: boolean) => void;
  onRecord: (questionId: number) => void;
  /** Final Test only: the exam skin's writing toolbar carries undo/redo. */
  languageCertSkin?: boolean;
}

export function QuestionPane({
  currentPart,
  questionPaneRef,
  questionNumberOffset,
  savingIds,
  recordingQuestionId,
  onChangeResponse,
  onRecord,
  languageCertSkin = false,
}: QuestionPaneProps) {
  const t = strings.questionPane;
  const isReading1a = currentPart.part_code === "reading_1a";
  const matchingType = currentPart.questions[0]?.question_type;
  const isMatchingPart = matchingType === "matching_unique" || matchingType === "matching_reusable";
  const usesInlineMatchingBlanks = isMatchingPart && currentPart.answer_constraints.layout === "inline_matching_blanks";
  const usesSourceTextMatching = isMatchingPart && (
    currentPart.answer_constraints.layout === "source_text_matching" || currentPart.part_code === "reading_3"
  );
  const usesSharedCloze = currentPart.part_code === "reading_1b" && currentPart.answer_constraints.layout === "shared_cloze";
  const usesNotepadGaps = currentPart.answer_constraints.layout === "notepad_gaps" && currentPart.questions.length > 0;
  const isListening1 = currentPart.part_code === "listening_1";
  // Listening 2 is the same answer sheet as Listening 1, split into labelled
  // conversations - so it renders through the same component.
  const usesConversationGroups = currentPart.answer_constraints.layout === "conversation_groups";

  return (
    <section className="test-runner-question-pane" ref={questionPaneRef} aria-label={`${currentPart.title} questions`}>
      {currentPart.section_type !== "writing" && !isListening1 && !usesConversationGroups && (
        <div className="test-runner-pane-heading test-runner-question-pane-heading">
          {currentPart.section_type !== "reading" && (
            <span>
              {currentPart.question_count} {t.questionsSuffix}
            </span>
          )}
          <h2>{currentPart.title}</h2>
          <p>{isReading1a ? (currentPart.instructions || t.instructions) : t.instructions}</p>
        </div>
      )}
      {isListening1 || usesConversationGroups ? (
        <ListeningChoiceGroups
          currentPart={currentPart}
          questionNumberOffset={questionNumberOffset}
          savingIds={savingIds}
          grouped={usesConversationGroups}
          languageCertSkin={languageCertSkin}
          onChangeResponse={(questionId, response) => onChangeResponse(questionId, response)}
        />
      ) : usesNotepadGaps ? (
        <NotepadGapsGroup
          questions={currentPart.questions}
          questionNumberOffset={questionNumberOffset}
          savingIds={savingIds}
          maxAnswerWords={currentPart.answer_constraints.max_answer_words}
          onChangeResponse={onChangeResponse}
        />
      ) : usesSharedCloze ? (
        <SharedClozeGroup
          questions={currentPart.questions}
          questionNumberOffset={questionNumberOffset}
          savingIds={savingIds}
          mode="options"
          onChangeResponse={(questionId, response) => onChangeResponse(questionId, response)}
        />
      ) : usesInlineMatchingBlanks ? (
        <InlineMatchingBlankGroup
          questions={currentPart.questions}
          questionNumberOffset={questionNumberOffset}
          savingIds={savingIds}
          reusable={matchingType === "matching_reusable"}
          mode="options"
          onChangeResponse={(questionId, response) => onChangeResponse(questionId, response)}
        />
      ) : usesSourceTextMatching ? (
        <SourceTextMatchingGroup
          questions={currentPart.questions}
          questionNumberOffset={questionNumberOffset}
          savingIds={savingIds}
          reusable={matchingType === "matching_reusable"}
          mode="targets"
          onChangeResponse={(questionId, response) => onChangeResponse(questionId, response)}
          languageCertSkin={languageCertSkin}
        />
      ) : isMatchingPart ? (
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
          allowBoldMarkup={isReading1a}
          maxAnswerWords={currentPart.answer_constraints.max_answer_words}
          saving={savingIds.has(question.id)}
          recording={recordingQuestionId === question.id}
          languageCertSkin={languageCertSkin}
          onChange={(response, debounce) => onChangeResponse(question.id, response, debounce)}
          onRecord={() => onRecord(question.id)}
        />
      ))}
    </section>
  );
}
