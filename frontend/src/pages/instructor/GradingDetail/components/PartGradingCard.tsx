import { useState } from "react";
import { API_BASE_URL, apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import type { AiEvaluationSuggestion, AttemptPart } from "@/api/types";
import { Badge, Button } from "@/components/ui";
import { useToastStore } from "@/store/toastStore";
import { gradingDetailStrings as strings } from "../GradingDetail.strings";

interface PartGradingCardProps {
  part: AttemptPart;
  attemptId: string;
  canEdit: boolean;
  aiConfigured: boolean;
  comment: string;
  onCommentChange: (value: string) => void;
  /** Pre-fill the score inputs when the instructor accepts the AI grade or
   *  requests a fresh AI draft. Lives on the page level so the floating rubric
   *  picks the new values up. */
  onApplySuggestion: (marks: Record<string, string>, comment: string) => void;
  /** Notified when this card scrolls into view so the floating rubric can
   *  switch to this part's criteria. */
  onActive: () => void;
}

export function PartGradingCard({
  part, attemptId, canEdit, aiConfigured, comment, onCommentChange, onApplySuggestion, onActive,
}: PartGradingCardProps) {
  const t = strings.part;
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);
  const [suggestion, setSuggestion] = useState<AiEvaluationSuggestion | null>(null);
  const [requestingAi, setRequestingAi] = useState(false);
  const supportsAi = part.section_type === "writing" || part.section_type === "speaking";
  const isPublished = part.grade?.status === "graded" || part.grade?.status === "ai_graded";
  const isDraft = part.grade?.status === "draft";
  const priorAiGrade = part.grade?.status === "ai_graded" ? part.grade : null;

  async function requestAiSuggestion() {
    setRequestingAi(true);
    try {
      const { data } = await apiClient.post<AiEvaluationSuggestion>(`/instructor/grading/${attemptId}/parts/${part.id}/ai-suggestion`);
      setSuggestion(data);
      onApplySuggestion(
        Object.fromEntries(data.criteria.map((item) => [item.criterion, item.marks_awarded])),
        data.comment,
      );
      showSuccess(t.aiSuccessMessage, t.aiSuccessTitle);
    } catch (err: unknown) {
      showError(extractErrorMessage(err, t.aiErrorMessage), t.aiErrorTitle);
    } finally {
      setRequestingAi(false);
    }
  }

  function acceptPriorAi() {
    if (!priorAiGrade) return;
    onApplySuggestion(
      Object.fromEntries(priorAiGrade.criteria.map((item) => [item.criterion, item.marks_awarded])),
      priorAiGrade.comment ?? "",
    );
  }

  const handleAudioPlay = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    document.querySelectorAll("audio").forEach((audio) => {
      if (audio !== e.currentTarget) (audio as HTMLAudioElement).pause();
    });
  };

  return (
    <section
      id={`part-card-${part.id}`}
      className="workspace-panel grading-part-panel"
      onFocus={onActive}
      onMouseEnter={onActive}
    >
      <div className="panel-heading">
        <div>
          <h2>{part.title}</h2>
          <p>{part.skill_focus}</p>
        </div>
        <div className="form-actions">
          {priorAiGrade && <Badge tone="info">{t.priorAiChip}</Badge>}
          {isPublished && !priorAiGrade && <Badge tone="green">{t.graded}</Badge>}
          {isDraft && <Badge tone="amber">{t.draftSaved}</Badge>}
          {canEdit && supportsAi && (
            <Button variant="secondary" size="sm" disabled={!aiConfigured || requestingAi} onClick={requestAiSuggestion}>
              {requestingAi ? t.generating : t.aiDraft}
            </Button>
          )}
        </div>
      </div>
      {canEdit && supportsAi && !aiConfigured && <p className="hint">{t.aiDisabledHint}</p>}
      {!supportsAi && <p className="hint">{t.speakingHint}</p>}

      {priorAiGrade && (
        <div className="ai-review-banner is-prior">
          <div>
            <strong>{t.priorAiTitle}</strong>
            <p>{t.priorAiSubtitle}</p>
          </div>
          <div className="ai-review-grid">
            <div>
              <span className="ai-review-heading">{t.priorAiMarksHeading}</span>
              <ul>
                {priorAiGrade.criteria.map((item) => (
                  <li key={item.criterion}>
                    <strong>{item.criterion}</strong>
                    <span>{item.marks_awarded} / {item.max_marks}</span>
                  </li>
                ))}
              </ul>
            </div>
            {priorAiGrade.comment && (
              <div>
                <span className="ai-review-heading">{t.priorAiCommentHeading}</span>
                <p>{priorAiGrade.comment}</p>
              </div>
            )}
          </div>
          {canEdit && (
            <div className="form-actions">
              <Button size="sm" variant="secondary" onClick={acceptPriorAi}>{t.priorAiAccept}</Button>
            </div>
          )}
        </div>
      )}

      {part.questions.map((question) => (
        <div key={question.id} className="test-runner-question grading-response">
          <p className="test-runner-prompt">{question.prompt}</p>
          {question.audio_path ? (
            <audio controls src={`${API_BASE_URL}${question.audio_path}`} onPlay={handleAudioPlay} />
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

      <label htmlFor={`comment-${part.id}`}>{t.commentLabel}</label>
      <textarea
        id={`comment-${part.id}`}
        rows={3}
        value={comment}
        disabled={!canEdit}
        onChange={(event) => onCommentChange(event.target.value)}
      />
      {canEdit && <p className="hint">{t.rubricSideHint}</p>}
    </section>
  );
}
