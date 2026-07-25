import type { FormEvent } from "react";
import { RequiredMark } from "@/components/ui";
import { attemptResultStrings as strings } from "../AttemptResult.strings";

interface ReevaluationRequestFormProps {
  reviewReason: string;
  onReviewReasonChange: (value: string) => void;
  requesting: boolean;
  reviewError: string | null;
  onSubmit: (event: FormEvent) => void;
}

export function ReevaluationRequestForm({ reviewReason, onReviewReasonChange, requesting, reviewError, onSubmit }: ReevaluationRequestFormProps) {
  const t = strings.reevaluationForm;
  return (
    <form className="workspace-panel reevaluation-form" onSubmit={onSubmit}>
      <div className="panel-heading">
        <div>
          <span className="page-eyebrow">{strings.reevaluation.eyebrow}</span>
          <h2>{t.heading}</h2>
          <p>{t.description}</p>
        </div>
      </div>
      {reviewError && <p className="error-text">{reviewError}</p>}
      <label htmlFor="result-review-reason">{t.reasonLabel}<RequiredMark /></label>
      <textarea
        id="result-review-reason"
        rows={4}
        minLength={20}
        maxLength={2000}
        required
        value={reviewReason}
        onChange={(event) => onReviewReasonChange(event.target.value)}
        placeholder={t.reasonPlaceholder}
      />
      <div className="form-actions">
        <button disabled={requesting || reviewReason.trim().length < 20}>{requesting ? t.sending : t.submit}</button>
      </div>
    </form>
  );
}
