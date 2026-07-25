import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import type { ExamModulePart } from "@/api/types";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";

interface PartSpecPanelProps {
  part: ExamModulePart;
}

export function PartSpecPanel({ part }: PartSpecPanelProps) {
  const t = strings.partSpec;
  return (
    <CollapsiblePanel
      className="part-spec-card"
      title={part.title}
      description={part.skill_focus}
      eyebrow={part.section_type}
      badge={<span className="count-chip">{t.questionsCount(part.questions.length, part.question_limit)}</span>}
    >
      {part.instructions && (
        <p className="part-instructions">
          <strong>{t.formatPrefix}</strong> {part.instructions}
        </p>
      )}
      <div className="part-facts">
        <span>{part.auto_marked ? t.autoMarked : t.examinerMarked}</span>
        {part.max_marks && <span>{t.rawMarks(part.max_marks)}</span>}
        {part.answer_constraints.audio_plays && <span>{t.audioPlays(part.answer_constraints.audio_plays)}</span>}
        {part.answer_constraints.minimum_words && <span>{t.minimumWords(part.answer_constraints.minimum_words)}</span>}
        {part.answer_constraints.maximum_words && <span>{t.maximumWords(part.answer_constraints.maximum_words)}</span>}
      </div>
      {!!part.rubric.length && (
        <details className="rubric-details" open>
          <summary>{t.rubricSummary(part.rubric.length)}</summary>
          <div className="rubric-grid">
            {part.rubric.map((criterion) => (
              <article key={criterion.criterion}>
                <div>
                  <strong>{criterion.criterion}</strong>
                  <span>{t.marksRange(criterion.max_marks)}</span>
                </div>
                <p>{criterion.description}</p>
              </article>
            ))}
          </div>
        </details>
      )}
    </CollapsiblePanel>
  );
}
