import { API_BASE_URL } from "@/api/client";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import type { ExamModulePart, ExamModuleQuestion } from "@/api/types";
import { renderRichText, RichTextContent } from "@/components/ui";
import { Button } from "@/components/ui/Button/Button";
import { renderBoldText } from "@/utils/boldText";
import { parseClozeMarkers } from "@/utils/clozeMarkers";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";

interface SavedQuestionsListProps {
  part: ExamModulePart;
  isEditable: boolean;
  onEdit: (question: ExamModuleQuestion) => void;
  onDelete: (question: ExamModuleQuestion) => void;
}

export function SavedQuestionsList({ part, isEditable, onEdit, onDelete }: SavedQuestionsListProps) {
  const t = strings.savedQuestions;
  const questionLabels = strings.questionLabels;
  const isSharedCloze = part.part_code === "reading_1b" && part.answer_constraints.layout === "shared_cloze";
  /* Every question in a shared-passage part stores the same passage, so
     printing it under each one repeated the whole text six or seven times.
     Show it once at the top of the list instead. */
  const usesSharedPassage = Boolean(part.answer_constraints.shared_passage);
  const sharedPassage = (isSharedCloze || usesSharedPassage)
    ? part.questions.find((question) => question.passage?.trim())?.passage?.trim() ?? ""
    : "";
  // A gap part is one task, not a list of questions - calling its rows
  // "questions" is what made six gaps read as six separate questions.
  const isGapTask = part.answer_constraints.layout === "inline_matching_blanks";
  return (
    <CollapsiblePanel
      className="question-list-section"
      title={isGapTask ? t.gapHeading(part.title) : t.heading(part.title)}
      description={isGapTask
        ? t.gapDescription(part.questions.length)
        : t.description(part.questions.length, part.question_limit)}
      badge={<span className="count-chip">{part.questions.length}</span>}
    >
      {!part.questions.length ? (
        <div className="empty-state compact-empty">
          <h2>{t.emptyTitle}</h2>
          <p>{t.emptyDescription}</p>
        </div>
      ) : (
        <div className="saved-question-list">
          {sharedPassage && (
            <article className="saved-question saved-cloze-passage">
              <p>
                {parseClozeMarkers(sharedPassage).map((token) => (
                  token.type === "text"
                    ? <span key={token.key}>{renderRichText(token.text)}</span>
                    : (
                      <span key={token.key} className="saved-cloze-blank">
                        <strong>({token.gapNumber})</strong>
                        <span className="saved-blank-dots">....................</span>
                      </span>
                    )
                ))}
              </p>
            </article>
          )}
          {part.questions.map((question, index) => (
            <article className="saved-question" key={question.id}>
              <div className="question-number">{index + 1}</div>
              <div className="question-body">
                <div className="question-meta">
                  <span>{questionLabels[question.question_type]}</span>
                  {question.interaction?.group_label && <span>{question.interaction.group_label}</span>}
                  {question.interaction?.turn_type && <span>{question.interaction.turn_type.replaceAll("_", " ")}</span>}
                </div>
                {!isSharedCloze && (
                  <h3>
                    {part.part_code === "listening_1" ? `Question ${index + 1}` : renderBoldText(question.prompt)}
                  </h3>
                )}
                {!isSharedCloze && !usesSharedPassage && part.section_type !== "writing" && question.passage && <RichTextContent text={question.passage} />}
                {question.image_url && (
                  <img className="saved-question-image" src={`${API_BASE_URL}${question.image_url}`} alt="" />
                )}
                {question.options.length > 0 && (
                  <ol className="saved-options" type="A">
                    {question.options.map((option) => (
                      <li className={question.correct_answers.includes(option.key) ? "correct" : ""} key={option.key}>
                        {option.text}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
              {isEditable && (
                <div className="question-actions">
                  <Button variant="secondary" className="secondary-button" onClick={() => onEdit(question)}>
                    {t.edit}
                  </Button>
                  <Button variant="danger" className="danger-text" onClick={() => onDelete(question)}>
                    {t.delete}
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </CollapsiblePanel>
  );
}
