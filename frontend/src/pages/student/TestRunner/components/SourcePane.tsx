import type { RefObject } from "react";
import { API_BASE_URL } from "@/api/client";
import type { Attempt, AttemptResponse } from "@/api/types";
import { renderRichText, RichTextContent } from "@/components/ui";
import { testRunnerStrings as strings } from "../TestRunner.strings";
import { InlineMatchingBlankGroup } from "./InlineMatchingBlankGroup";
import { SourceTextMatchingGroup } from "./SourceTextMatchingGroup";
import { SharedClozeGroup } from "./SharedClozeGroup";
import { CustomAudioPlayer } from "./CustomAudioPlayer";
import { formatPartTitle } from "./PartsNav";

interface SourcePaneProps {
  currentPart: Attempt["parts"][number];
  passages: string[];
  images: string[];
  sourcePaneRef: RefObject<HTMLElement | null>;
  questionNumberOffset: number;
  savingIds: Set<number>;
  onChangeResponse: (questionId: number, response: AttemptResponse) => void;
  /** Final Test only: the exam skin titles writing tasks "Writing Part 1". */
  languageCertSkin?: boolean;
}

export function SourcePane({
  currentPart,
  passages,
  images,
  sourcePaneRef,
  questionNumberOffset,
  savingIds,
  onChangeResponse,
  languageCertSkin = false,
}: SourcePaneProps) {
  const t = strings.sourcePane;
  const sectionLabels = strings.sectionLabels;
  const isWriting = currentPart.section_type === "writing";
  const isWriting2 = isWriting && (
    currentPart.part_code === "writing_2" ||
    currentPart.part_code.endsWith("writing_2") ||
    (currentPart.title || "").toLowerCase().includes("writing 2")
  );
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
  const isReading4 = currentPart.section_type === "reading" && (
    currentPart.part_code === "reading_4"
    || currentPart.part_code.endsWith("reading_4")
    || currentPart.part_code.endsWith("_4")
    || (currentPart.title || "").toLowerCase().includes("reading 4")
    || (currentPart.title || "").toLowerCase().includes("reading part 4")
  );
  /* The notepad is the answer surface, so it is rendered once in the question
     pane. Its text also rides along on every question as the passage - showing
     that here would repeat the whole notepad, blank markers and all. */
  const usesNotepadGaps = currentPart.answer_constraints.layout === "notepad_gaps";
  const sourcePassages = usesNotepadGaps || isWriting ? [] : passages;

  function formatJustifiedReadingPassage(text: string): string {
    if (!text?.trim()) return "";
    let normalized = text.trim();
    const rawLines = normalized.split("\n");
    if (
      rawLines.length > 1 &&
      rawLines[0].trim().length > 0 &&
      rawLines[0].trim().length <= 75 &&
      !/[.,;:!?]$/.test(rawLines[0].trim()) &&
      !rawLines[0].startsWith("#") &&
      rawLines[1].trim().length > 0
    ) {
      normalized = rawLines[0].trim() + "\n\n" + rawLines.slice(1).join("\n");
    }

    const chunks = normalized.split(/\n\s*\n+/);
    const paragraphs: string[] = [];
    for (const chunk of chunks) {
      const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
      if (!lines.length) continue;
      if (/^([#>\-*]|\d+\.)/.test(lines[0])) {
        paragraphs.push(chunk.trim());
      } else {
        paragraphs.push(lines.join(" "));
      }
    }
    return paragraphs.join("\n\n");
  }

  return (
    <section className="test-runner-source-pane" ref={sourcePaneRef}>
      <div className="test-runner-pane-heading">
        {isWriting ? (
          <h2 style={languageCertSkin ? undefined : { fontSize: 18, fontWeight: 800, textTransform: "uppercase", color: "color-mix(in srgb, var(--test-accent, var(--primary)) 88%, #111113)", margin: 0 }}>
            {/* The exam prints the task's own name - "Writing Part 1" - which
                is the same label the section rail carries. */}
            {formatPartTitle(currentPart.title || currentPart.part_code.replaceAll("_", " "))}
          </h2>
        ) : (
          <>
            <h2>{sourcePassages.length > 0 ? t.sourceMaterial : t.partInstructions}</h2>
            {currentPart.section_type !== "reading" && currentPart.skill_focus && <p>{currentPart.skill_focus}</p>}
          </>
        )}
      </div>
      {/* Instructions stay one flex row (see `.test-runner-instructions`), so
          they take the inline renderer rather than the block one. */}
      {!isWriting && currentPart.instructions && (
        <p className="test-runner-instructions">{renderRichText(currentPart.instructions)}</p>
      )}
      {isWriting && currentPart.questions.map((question, qIdx) => {
        const questionImageUrl = !isWriting2 ? (question.image_url || images[qIdx] || images[0] || null) : null;
        const hasImage = Boolean(questionImageUrl);
        const hasPassage = Boolean(question.passage?.trim());

        return (
          <div className="test-runner-writing-prompt" key={`writing-prompt-${question.id}`} style={{ marginBottom: 14 }}>
            <div
              className="test-runner-writing-passage-frame"
              style={{
                marginTop: 6,
                marginBottom: 10,
                padding: "18px 20px",
                background: "var(--surface-color-variant, rgba(0, 0, 0, 0.03))",
                borderRadius: 8,
                border: "1px solid var(--border-color, rgba(0, 0, 0, 0.08))",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "14px",
              }}
            >
              {currentPart.questions.length > 1 && (
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px", color: "#6c6e76", width: "100%", textAlign: "left" }}>
                  Question {qIdx + 1}
                </div>
              )}
              {question.prompt && (
                <div
                  className="test-runner-prompt test-runner-writing-prompt-text"
                  style={{
                    width: "100%",
                    fontSize: 14.5,
                    fontWeight: 700,
                    lineHeight: 1.5,
                    color: "var(--text-main)",
                    textAlign: "left",
                  }}
                >
                  {question.prompt}
                </div>
              )}
              {question.instructions && (
                <p className="hint" style={{ width: "100%", fontSize: 12.5, color: "var(--text-muted)", margin: 0, textAlign: "left" }}>
                  {question.instructions}
                </p>
              )}
              {hasImage && (
                <div
                  className="test-runner-writing-image-wrapper"
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <img
                    src={questionImageUrl!.startsWith("http") ? questionImageUrl! : `${API_BASE_URL}${questionImageUrl!.startsWith("/") ? "" : "/"}${questionImageUrl!}`}
                    alt="Writing task visual"
                    style={{
                      width: "60%",
                      maxWidth: "60%",
                      height: "auto",
                      maxHeight: "440px",
                      objectFit: "contain",
                      borderRadius: 6,
                      display: "block",
                      margin: "0 auto",
                    }}
                  />
                </div>
              )}
              {hasPassage && (
                <div
                  className="test-runner-writing-passage-text"
                  style={{
                    width: "100%",
                    fontSize: 13.5,
                    lineHeight: 1.65,
                    color: "var(--text-main)",
                    textAlign: "left",
                  }}
                >
                  <RichTextContent text={question.passage!} />
                </div>
              )}
            </div>
          </div>
        );
      })}
      {!isWriting && images.map((url, index) => (
        <div className="test-runner-question-image" key={`${currentPart.id}-image-${index}`}>
          <img src={`${API_BASE_URL}${url}`} alt="" />
        </div>
      ))}
      {/* Listening never reaches this pane - its recording plays from the
          pinned header bar, so there is no narrator portrait here. */}
      {currentPart.assets.map((asset) => (
        <div className="test-runner-asset" key={asset.id}>
          {asset.asset_type === "avatar_mp4" && asset.url ? (
            <video controls src={`${API_BASE_URL}${asset.url}`} />
          ) : asset.url ? (
            <CustomAudioPlayer src={`${API_BASE_URL}${asset.url}`} />
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
          languageCertSkin={languageCertSkin}
        />
      ) : sourcePassages.length > 0 ? (
        sourcePassages.map((passage, index) => {
          const displayPassage = isReading4 ? formatJustifiedReadingPassage(passage) : passage;
          return (
            <article
              className={`test-runner-passage${isReading4 ? " is-reading-4" : ""}`}
              key={`${currentPart.id}-${index}`}
            >
              {sourcePassages.length > 1 && (
                <strong>
                  {t.passagePrefix} {index + 1}
                </strong>
              )}
              <RichTextContent text={displayPassage} />
            </article>
          );
        })
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
