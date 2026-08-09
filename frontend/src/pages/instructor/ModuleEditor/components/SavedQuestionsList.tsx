import { API_BASE_URL } from "@/api/client";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import type { ExamModulePart, ExamModuleQuestion } from "@/api/types";
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
          {part.questions.map((question, index) => (
            <article className="saved-question" key={question.id}>
              <div className="question-number">{index + 1}</div>
              <div className="question-body">
                <div className="question-meta">
                  <span>{questionLabels[question.question_type]}</span>
                  <span>
                    {question.points} {t.marksSuffix(Number(question.points))}
                  </span>
                  <span>
                    {question.source_type}
                    {question.source_filename ? ` · ${question.source_filename}` : ""}
                  </span>
                </div>
                <h3>{question.prompt}</h3>
                {question.passage && <p>{question.passage}</p>}
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
