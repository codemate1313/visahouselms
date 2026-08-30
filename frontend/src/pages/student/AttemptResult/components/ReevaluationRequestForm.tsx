import type { FormEvent } from "react";
import { Modal, RequiredMark } from "@/components/ui";
import { Button } from "@/components/ui/Button/Button";
import { attemptResultStrings as strings } from "../AttemptResult.strings";

interface ReevaluationRequestModalProps {
  open: boolean;
  onClose: () => void;
  reviewReason: string;
  onReviewReasonChange: (value: string) => void;
  requesting: boolean;
  reviewError: string | null;
  onSubmit: (event: FormEvent) => void;
}

export function ReevaluationRequestModal({
  open,
  onClose,
  reviewReason,
  onReviewReasonChange,
  requesting,
  reviewError,
  onSubmit,
}: ReevaluationRequestModalProps) {
  const t = strings.reevaluationForm;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={
        <div className="result-modal-header-block">
          <span className="page-eyebrow">{strings.reevaluation.eyebrow}</span>
          <h2>{t.heading}</h2>
        </div>
      }
      actions={
        <div className="result-modal-actions-bar">
          <Button type="button" variant="secondary" onClick={onClose} disabled={requesting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={onSubmit}
            disabled={requesting || reviewReason.trim().length === 0}
          >
            {requesting ? t.sending : t.submit}
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="result-modal-form-content">
        <p className="result-modal-description">{t.description}</p>
        {reviewError && <p className="error-text">{reviewError}</p>}
        <label htmlFor="result-review-reason" className="result-modal-label">
          {t.reasonLabel} <RequiredMark />
        </label>
        <textarea
          id="result-review-reason"
          rows={4}
          minLength={1}
          maxLength={2000}
          required
          value={reviewReason}
          onChange={(event) => onReviewReasonChange(event.target.value)}
          placeholder={t.reasonPlaceholder}
          className="ui-textarea"
          autoFocus
        />
        <div className="result-modal-char-count">
          <span>{reviewReason.length} / 2000</span>
        </div>
      </form>
    </Modal>
  );
}

