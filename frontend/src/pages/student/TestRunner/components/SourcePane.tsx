import type { RefObject } from "react";
import { API_BASE_URL } from "@/api/client";
import { ListeningMediaAvatar } from "@/components/listening/ListeningMediaAvatar";
import type { Attempt, AttemptResponse } from "@/api/types";
import { testRunnerStrings as strings } from "../TestRunner.strings";
import { InlineMatchingBlankGroup } from "./InlineMatchingBlankGroup";
import { SourceTextMatchingGroup } from "./SourceTextMatchingGroup";
import { SharedClozeGroup } from "./SharedClozeGroup";

interface SourcePaneProps {
  currentPart: Attempt["parts"][number];
  passages: string[];
  images: string[];
  sourcePaneRef: RefObject<HTMLElement | null>;
  questionNumberOffset: number;
  savingIds: Set<number>;
  onChangeResponse: (questionId: number, response: AttemptResponse) => void;
}

export function SourcePane({
  currentPart,
  passages,
  images,
  sourcePaneRef,
  questionNumberOffset,
  savingIds,
  onChangeResponse,
}: SourcePaneProps) {
  const t = strings.sourcePane;
  const sectionLabels = strings.sectionLabels;
  const isWriting = currentPart.section_type === "writing";
  const matchingType = currentPart.questions[0]?.question_type;
  const usesInlineMatchingBlanks = (
    currentPart.answer_constraints.layout === "inline_matching_blanks"
    && (matchingType === "matching_unique" || matchingType === "matching_reusable")
  );
  const usesSourceTextMatching = (
    (currentPart.answer_constraints.layout === "source_text_matching" || currentPart.part_code === "reading_3")
    && (matchingType === "matching_unique" || matchingType === "matching_reusable")
  );
  const usesSharedCloze = currentPart.part_code === "reading_1b" && currentPart.answer_constraints.layout === "shared_cloze";
  return (
    <section className="test-runner-source-pane" ref={sourcePaneRef}>
      <div className="test-runner-pane-heading">
        {isWriting ? (
          <h2 style={{ fontSize: 18, fontWeight: 800, textTransform: "uppercase", color: "color-mix(in srgb, var(--test-accent, var(--primary)) 88%, #111113)", margin: 0 }}>
            {currentPart.part_code.replaceAll("_", " ")}
          </h2>
        ) : (
          <>
            <span>{currentPart.part_code.replaceAll("_", " ")}</span>
            <h2>{passages.length > 0 ? t.sourceMaterial : t.partInstructions}</h2>
            {currentPart.skill_focus && <p>{currentPart.skill_focus}</p>}
          </>
        )}
      </div>
      {!isWriting && currentPart.instructions && <p className="test-runner-instructions">{currentPart.instructions}</p>}
      {isWriting && currentPart.questions.map((question, qIdx) => (
        <div className="test-runner-writing-prompt" key={`writing-prompt-${question.id}`} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px", color: "#6c6e76", marginBottom: 4 }}>
            Question {qIdx + 1}
          </div>
          {question.prompt && (
            <p className="test-runner-prompt" style={{ fontSize: 14, fontWeight: 700, color: "var(--text-main)", marginBottom: question.instructions ? 4 : 0 }}>
              {question.prompt}
            </p>
          )}
          {question.instructions && <p className="hint" style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>{question.instructions}</p>}
        </div>
      ))}
      {images.map((url, index) => (
        <div className="test-runner-question-image" key={`${currentPart.id}-image-${index}`}>
          <img src={`${API_BASE_URL}${url}`} alt="" />
        </div>
      ))}
      {currentPart.assets.map((asset) => (
        <div className="test-runner-asset" key={asset.id}>
          {currentPart.section_type === "listening" ? (
            <ListeningMediaAvatar asset={asset} />
          ) : asset.asset_type === "avatar_mp4" && asset.url ? (
            <video controls src={`${API_BASE_URL}${asset.url}`} />
          ) : asset.url ? (
            <audio controls src={`${API_BASE_URL}${asset.url}`} />
          ) : null}
        </div>
      ))}
      {usesSharedCloze ? (
        <SharedClozeGroup
          questions={currentPart.questions}
          questionNumberOffset={questionNumberOffset}
          savingIds={savingIds}
          mode="source"
          onChangeResponse={onChangeResponse}
        />
      ) : usesInlineMatchingBlanks ? (
        <InlineMatchingBlankGroup
          questions={currentPart.questions}
          questionNumberOffset={questionNumberOffset}
          savingIds={savingIds}
          reusable={matchingType === "matching_reusable"}
          mode="source"
          onChangeResponse={onChangeResponse}
        />
      ) : usesSourceTextMatching ? (
        <SourceTextMatchingGroup
          questions={currentPart.questions}
          questionNumberOffset={questionNumberOffset}
          savingIds={savingIds}
          reusable={matchingType === "matching_reusable"}
          mode="source"
          onChangeResponse={onChangeResponse}
        />
      ) : passages.length > 0 ? (
        passages.map((passage, index) => (
          <article className="test-runner-passage" key={`${currentPart.id}-${index}`}>
            {passages.length > 1 && (
              <strong>
                {t.passagePrefix} {index + 1}
              </strong>
            )}
            <p>{passage}</p>
          </article>
        ))
      ) : !isWriting && images.length === 0 && currentPart.assets.length === 0 ? (
        <div className="test-runner-source-placeholder">
          <strong>
            {sectionLabels[currentPart.section_type as keyof typeof sectionLabels]} {t.taskSuffix}
          </strong>
          <p>{t.defaultInstructions}</p>
        </div>
      ) : null}
    </section>
  );
}
