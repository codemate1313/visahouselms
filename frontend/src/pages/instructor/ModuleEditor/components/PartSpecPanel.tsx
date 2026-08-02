import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import type { ExamModulePart } from "@/api/types";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";

interface PartSpecPanelProps {
  part: ExamModulePart;
  isEditable: boolean;
  busy: boolean;
  onToggleAiEvaluation: (enabled: boolean) => void;
}

export function PartSpecPanel({ part, isEditable, busy, onToggleAiEvaluation }: PartSpecPanelProps) {
  const t = strings.partSpec;
  const canUseAiEvaluation = !part.auto_marked && ["writing", "speaking"].includes(part.section_type);
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
        <span>{part.ai_evaluation_enabled ? t.aiEvaluationOn : t.aiEvaluationOff}</span>
        {part.max_marks && <span>{t.rawMarks(part.max_marks)}</span>}
        {part.answer_constraints.audio_plays && <span>{t.audioPlays(part.answer_constraints.audio_plays)}</span>}
        {part.answer_constraints.minimum_words && <span>{t.minimumWords(part.answer_constraints.minimum_words)}</span>}
        {part.answer_constraints.maximum_words && <span>{t.maximumWords(part.answer_constraints.maximum_words)}</span>}
      </div>
      <div className="part-ai-evaluation-setting">
        <div>
          <strong>{t.aiEvaluation}</strong>
          <p>{canUseAiEvaluation ? t.aiEvaluationHint : t.aiEvaluationUnavailable}</p>
        </div>
        <label className="part-ai-toggle">
          <input
            type="checkbox"
            checked={part.ai_evaluation_enabled}
            disabled={!isEditable || busy || !canUseAiEvaluation}
            onChange={(event) => onToggleAiEvaluation(event.currentTarget.checked)}
          />
          <span />
        </label>
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
