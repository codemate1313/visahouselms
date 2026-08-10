import type { Attempt, AttemptQuestion } from "@/api/types";
import { Badge, renderRichText, type BadgeTone } from "@/components/ui";
import { formatAttemptAnswer, hasAttemptResponse } from "@/pages/student/attemptMetrics";
import { attemptResultDetailsStrings as strings } from "../AttemptResultDetails.strings";

function questionOutcome(question: AttemptQuestion): { label: string; badge: BadgeTone } {
  const t = strings.outcome;
  if (!hasAttemptResponse(question)) return { label: t.unanswered, badge: "gray" };
  if (question.is_correct === true) return { label: t.correct, badge: "green" };
  if (question.is_correct === false) return { label: t.incorrect, badge: "red" };
  return { label: t.pendingReview, badge: "amber" };
}

interface PartReviewSectionProps {
  part: Attempt["parts"][number];
}

export function PartReviewSection({ part }: PartReviewSectionProps) {
  const t = strings.partReview;
  return (
    <section className="workspace-panel result-review-part">
      <div className="panel-heading">
        <div>
          <h2>
            {part.title}
            {part.grade?.status === "ai_graded" && (
              <Badge tone="info" className="result-ai-graded-badge">
                {t.aiGradedBadge}
              </Badge>
            )}
          </h2>
          <p>{part.skill_focus}</p>
        </div>
        {(part.max_marks || part.rubric.length > 0) && (
          <strong>
            {part.auto_marked
              ? `${part.questions.reduce((sum, question) => sum + Number(question.points_awarded ?? 0), 0)} / ${part.max_marks}`
              : part.grade?.total_marks
                ? `${part.grade.total_marks} / ${part.rubric.reduce((sum, item) => sum + Number(item.max_marks), 0)}`
                : t.pendingTotal}
          </strong>
        )}
      </div>

      {part.auto_marked ? (
        <div className="table-wrap">
          <table className="data-table result-review-table">
            <thead>
              <tr>
                <th>{t.tableHeaders.question}</th>
                <th>{t.tableHeaders.yourAnswer}</th>
                <th>{t.tableHeaders.correctAnswer}</th>
                <th>{t.tableHeaders.result}</th>
              </tr>
            </thead>
            <tbody>
              {part.questions.map((question, index) => {
                const outcome = questionOutcome(question);
                return (
                  <tr key={question.id} className={`is-${outcome.label.toLowerCase().replace(" ", "-")}`}>
                    <td>
                      {index + 1}. {renderRichText(question.prompt)}
                    </td>
                    <td>{formatAttemptAnswer(question)}</td>
                    <td>{question.correct_answers?.join(", ") ?? "-"}</td>
                    <td>
                      <Badge tone={outcome.badge}>{outcome.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : part.grade ? (
        <div className="rubric-details">
          <div className="rubric-grid">
            {part.grade.criteria.map((criterion) => (
              <article key={criterion.criterion}>
                <div>
                  <strong>{criterion.criterion}</strong>
                  <span>
                    {criterion.cefr_level} - {criterion.marks_awarded}/{criterion.max_marks}
                  </span>
                </div>
                {criterion.rationale && <p className="hint">{criterion.rationale}</p>}
              </article>
            ))}
          </div>
          {part.grade.comment && (
            <p className="hint">
              {part.grade.status === "ai_graded" ? t.aiComment : t.examinerComment} {part.grade.comment}
            </p>
          )}
          {part.grade.status === "ai_graded" && <p className="hint">{t.aiGradedHint}</p>}
        </div>
      ) : (
        <p className="empty-message">{t.notGradedYet}</p>
      )}
    </section>
  );
}
