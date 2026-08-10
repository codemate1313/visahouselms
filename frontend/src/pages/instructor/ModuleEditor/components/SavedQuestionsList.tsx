import { API_BASE_URL } from "@/api/client";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import type { ExamModulePart, ExamModuleQuestion } from "@/api/types";
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
  const sharedPassage = isSharedCloze ? part.questions.find((question) => question.passage?.trim())?.passage?.trim() ?? "" : "";
  return (
    <CollapsiblePanel
      className="question-list-section"
      title={t.heading(part.title)}
      description={t.description(part.questions.length, part.question_limit)}
      badge={<span className="count-chip">{part.questions.length}</span>}
    >
      {!part.questions.length ? (
        <div className="empty-state compact-empty">
          <h2>{t.emptyTitle}</h2>
          <p>{t.emptyDescription}</p>
        </div>
      ) : (
        <div className="saved-question-list">
          {isSharedCloze && sharedPassage && (
            <article className="saved-question saved-cloze-passage">
              <p>
                {parseClozeMarkers(sharedPassage).map((token) => (
                  token.type === "text"
                    ? <span key={token.key}>{token.text}</span>
                    : <strong key={token.key} className="saved-cloze-marker">({token.gapNumber})</strong>
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
                {!isSharedCloze && <h3>{part.part_code === "reading_1a" ? renderBoldText(question.prompt) : question.prompt}</h3>}
                {!isSharedCloze && part.section_type !== "writing" && question.passage && <p>{question.passage}</p>}
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
                  <button className="secondary-button" onClick={() => onEdit(question)}>
                    {t.edit}
                  </button>
                  <button className="danger-text" onClick={() => onDelete(question)}>
                    {t.delete}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </CollapsiblePanel>
  );
}
