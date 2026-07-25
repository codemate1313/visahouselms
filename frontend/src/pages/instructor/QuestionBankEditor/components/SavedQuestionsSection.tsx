import type { Question, QuestionBank } from "@/api/types";
import { questionBankEditorStrings as strings } from "../QuestionBankEditor.strings";
import { typeLabel } from "../helpers";

interface SavedQuestionsSectionProps {
  bank: QuestionBank;
  questionCountLabel: string;
  canEdit: boolean;
  onEdit: (question: Question) => void;
  onRemove: (question: Question) => void;
}

export function SavedQuestionsSection({ bank, questionCountLabel, canEdit, onEdit, onRemove }: SavedQuestionsSectionProps) {
  const t = strings.savedQuestions;
  return (
    <section className="question-list-section">
      <div className="section-heading">
        <div>
          <h2>{t.heading}</h2>
          <p>{t.description(questionCountLabel)}</p>
        </div>
      </div>
      {!bank.questions?.length ? (
        <div className="empty-state compact-empty">
          <h2>{t.emptyTitle}</h2>
          <p>{t.emptyDescription}</p>
        </div>
      ) : (
        <div className="saved-question-list">
          {bank.questions.map((question, index) => (
            <article className="saved-question" key={question.id}>
              <div className="question-number">{index + 1}</div>
              <div className="question-body">
                <div className="question-meta">
                  <span>{typeLabel(question.question_type)}</span>
                  <span>{question.difficulty}</span>
                  <span>
                    {question.points} {t.pointsSuffix}
                  </span>
                  <span>
                    {question.source_type}
                    {question.source_filename ? ` · ${question.source_filename}` : ""}
                  </span>
                </div>
                <h3>{question.prompt}</h3>
                {question.options.length > 0 && (
                  <ol className="saved-options" type="A">
                    {question.options.map((option) => (
                      <li className={question.correct_answers.includes(option.key) ? "correct" : ""} key={option.key}>
                        {option.text}
                      </li>
                    ))}
                  </ol>
                )}
                {question.correct_answers.length > 0 && !question.options.length && (
                  <p className="answer-line">
                    {t.accepted} {question.correct_answers.join(", ")}
                  </p>
                )}
              </div>
              {canEdit && (
                <div className="question-actions">
                  <button className="secondary-button" onClick={() => onEdit(question)}>
                    {t.edit}
                  </button>
                  <button className="danger-text" onClick={() => onRemove(question)}>
                    {t.delete}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
