import { useState } from "react";
import { API_BASE_URL, apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import type { AiEvaluationSuggestion, AttemptPart, GradingDetail as GradingDetailType } from "@/api/types";
import { Button } from "@/components/ui";
import { useToastStore } from "@/store/toastStore";
import { gradingDetailStrings as strings } from "../GradingDetail.strings";

function levelForMarks(value: string, maximum: number) {
  if (value === "" || maximum <= 0) return strings.levels.notScored;
  const percentage = (Number(value) / maximum) * 100;
  if (percentage >= 90) return strings.levels.c2;
  if (percentage >= 75) return strings.levels.c1;
  if (percentage >= 60) return strings.levels.b2;
  if (percentage >= 40) return strings.levels.b1;
  return strings.levels.belowB1;
}

interface PartGradingCardProps {
  part: AttemptPart;
  attemptId: string;
  canEdit: boolean;
  aiConfigured: boolean;
  onGraded: (detail: GradingDetailType) => void;
}

export function PartGradingCard({ part, attemptId, canEdit, aiConfigured, onGraded }: PartGradingCardProps) {
  const t = strings.part;
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);
  const [marks, setMarks] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      part.rubric.map((criterion) => [
        criterion.criterion,
        part.grade?.criteria.find((item) => item.criterion === criterion.criterion)?.marks_awarded ?? "",
      ])
    )
  );
  const [comment, setComment] = useState(part.grade?.comment ?? "");
  const [suggestion, setSuggestion] = useState<AiEvaluationSuggestion | null>(null);
  const [saving, setSaving] = useState(false);
  const [requestingAi, setRequestingAi] = useState(false);
  const allScored = part.rubric.every((criterion) => marks[criterion.criterion] !== "");
  const supportsAi = part.section_type === "writing";

  async function requestAiSuggestion() {
    setRequestingAi(true);
    try {
      const { data } = await apiClient.post<AiEvaluationSuggestion>(`/instructor/grading/${attemptId}/parts/${part.id}/ai-suggestion`);
      setSuggestion(data);
      setMarks(Object.fromEntries(data.criteria.map((item) => [item.criterion, item.marks_awarded])));
      setComment(data.comment);
      showSuccess(t.aiSuccessMessage, t.aiSuccessTitle);
    } catch (err: unknown) {
      showError(extractErrorMessage(err, t.aiErrorMessage), t.aiErrorTitle);
    } finally {
      setRequestingAi(false);
    }
  }

  async function submitGrade() {
    setSaving(true);
    try {
      const criteria = part.rubric.map((criterion) => ({ criterion: criterion.criterion, marks_awarded: Number(marks[criterion.criterion] || 0) }));
      const { data } = await apiClient.post<GradingDetailType>(`/instructor/grading/${attemptId}/parts/${part.id}`, { criteria, comment: comment || undefined });
      onGraded(data);
      showSuccess(t.gradedMessage(part.title), t.savedTitle);
    } catch (err: unknown) {
      showError(extractErrorMessage(err, t.saveErrorMessage), t.saveErrorTitle);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="workspace-panel grading-part-panel">
      <div className="panel-heading">
        <div>
          <h2>{part.title}</h2>
          <p>{part.skill_focus}</p>
        </div>
        <div className="form-actions">
          {part.grade?.status === "graded" && <span className="badge badge-green">{t.graded}</span>}
          {canEdit && supportsAi && (
            <Button variant="secondary" size="sm" disabled={!aiConfigured || requestingAi} onClick={requestAiSuggestion}>
              {requestingAi ? t.generating : t.aiDraft}
            </Button>
          )}
        </div>
      </div>
      {canEdit && supportsAi && !aiConfigured && <p className="hint">{t.aiDisabledHint}</p>}
      {!supportsAi && <p className="hint">{t.speakingHint}</p>}

      {part.questions.map((question) => (
        <div key={question.id} className="test-runner-question grading-response">
          <p className="test-runner-prompt">{question.prompt}</p>
          {question.audio_path ? (
            <audio controls src={`${API_BASE_URL}${question.audio_path}`} />
          ) : (
            <p className="hint">{question.response?.text || t.noResponse}</p>
          )}
        </div>
      ))}

      {suggestion && (
        <div className="ai-review-banner">
          <div>
            <strong>{t.aiBannerTitle}</strong>
            <p>{t.aiBannerConfidence(Math.round(Number(suggestion.confidence) * 100))}</p>
          </div>
          {suggestion.criteria.map((item) => (
            <p key={item.criterion}>
              <strong>{item.criterion}:</strong> {item.rationale || t.noRationale}
            </p>
          ))}
        </div>
      )}

      <details className="rubric-details" open>
        <summary>{t.rubricSummary(part.rubric.length)}</summary>
        <div className="cefr-anchor-scale" aria-label={t.cefrAnchorAriaLabel}>
          {part.cefr_scale.map((anchor) => (
            <div key={anchor.level}>
              <strong>{anchor.level}</strong>
              <span>{anchor.marks}</span>
              <p>{anchor.descriptor}</p>
            </div>
          ))}
        </div>
        <div className="rubric-grid">
          {part.rubric.map((criterion) => (
            <article key={criterion.criterion}>
              <div>
                <strong>{criterion.criterion}</strong>
                <span className="cefr-mark-level">{levelForMarks(marks[criterion.criterion], criterion.max_marks)}</span>
              </div>
              <p>{criterion.description}</p>
              <label htmlFor={`criterion-${part.id}-${criterion.criterion}`}>{t.markLabel(criterion.max_marks)}</label>
              <input
                id={`criterion-${part.id}-${criterion.criterion}`}
                type="number"
                min={0}
                max={criterion.max_marks}
                step={0.5}
                value={marks[criterion.criterion]}
                disabled={!canEdit}
                onChange={(event) => setMarks((current) => ({ ...current, [criterion.criterion]: event.target.value }))}
              />
            </article>
          ))}
        </div>
      </details>
      <label htmlFor={`comment-${part.id}`}>{t.commentLabel}</label>
      <textarea id={`comment-${part.id}`} rows={3} value={comment} disabled={!canEdit} onChange={(event) => setComment(event.target.value)} />
      {canEdit && (
        <div className="form-actions">
          <Button onClick={submitGrade} disabled={saving || !allScored}>
            {saving ? t.saving : t.confirmEvaluation}
          </Button>
        </div>
      )}
    </section>
  );
}
