import { testRunnerStrings as strings } from "../TestRunner.strings";
import { Button } from "@/components/ui/Button/Button";

interface SubmitConfirmModalProps {
  answeredCount: number;
  totalQuestions: number;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
  continueToSpeaking?: boolean;
  /** Closes the written paper without starting the interview. Absent when
   *  there is no Speaking section to defer. */
  onDeferSpeaking?: () => void;
}

export function SubmitConfirmModal({
  answeredCount,
  totalQuestions,
  submitting,
  onClose,
  onConfirm,
  continueToSpeaking = false,
  onDeferSpeaking,
}: SubmitConfirmModalProps) {
  const t = strings.submitModal;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal-card${continueToSpeaking ? " speaking-choice-modal" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{continueToSpeaking ? t.speakingHeading : t.heading}</h2>
        <p>
          {t.summary(answeredCount, totalQuestions)} {continueToSpeaking ? t.speakingWarning : t.standardWarning}
        </p>
        <div className="form-actions">
          <Button variant="secondary" className="secondary-button" onClick={onClose} disabled={submitting}>
            {t.keepWorking}
          </Button>
          {continueToSpeaking && onDeferSpeaking && (
            <Button variant="secondary" className="secondary-button" onClick={onDeferSpeaking} disabled={submitting}>
              {t.speakingLater}
            </Button>
          )}
          <Button onClick={onConfirm} disabled={submitting}>
            {submitting ? strings.footer.submitting : continueToSpeaking ? t.startSpeakingNow : t.submitNow}
          </Button>
        </div>
      </div>
    </div>
  );
}
