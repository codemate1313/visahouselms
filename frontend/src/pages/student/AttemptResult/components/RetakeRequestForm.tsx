import type { FormEvent } from "react";
import { Modal, RequiredMark } from "@/components/ui";
import { Button } from "@/components/ui/Button/Button";
import { attemptResultStrings as strings } from "../AttemptResult.strings";

interface RetakeRequestModalProps {
  open: boolean;
  onClose: () => void;
  reason: string;
  onReasonChange: (value: string) => void;
  requesting: boolean;
  error?: string | null;
  onSubmit: (event: FormEvent) => void;
}

export function RetakeRequestModal({
  open,
  onClose,
  reason,
  onReasonChange,
  requesting,
  error,
  onSubmit,
}: RetakeRequestModalProps) {
  const t = strings.retakeForm;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={
        <div className="result-modal-header-block">
          <span className="page-eyebrow">{t.eyebrow}</span>
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
            disabled={requesting || reason.trim().length === 0}
          >
            {requesting ? t.submitting : t.submit}
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="result-modal-form-content">
        <p className="result-modal-description">{t.description}</p>
        {error && <p className="error-text">{error}</p>}
        <label htmlFor="retake-reason" className="result-modal-label">
          {t.reasonLabel} <RequiredMark />
        </label>
        <textarea
          id="retake-reason"
          rows={4}
          minLength={1}
          maxLength={2000}
          required
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder="Explain what occurred during the test (e.g. power cut, technical glitch, mic issue)..."
          className="ui-textarea"
          autoFocus
        />
        <div className="result-modal-char-count">
          <span>{reason.length} / 2000</span>
        </div>
      </form>
    </Modal>
  );
}

