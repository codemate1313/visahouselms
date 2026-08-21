import { testRunnerStrings as strings } from "../TestRunner.strings";

interface SubmitConfirmModalProps {
  answeredCount: number;
  totalQuestions: number;
  isFinal: boolean;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
  continueToSpeaking?: boolean;
}

export function SubmitConfirmModal({ answeredCount, totalQuestions, isFinal, submitting, onClose, onConfirm, continueToSpeaking = false }: SubmitConfirmModalProps) {
  const t = strings.submitModal;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>{continueToSpeaking ? t.speakingHeading : t.heading}</h2>
        <p>
          {t.summary(answeredCount, totalQuestions)} {continueToSpeaking ? t.speakingWarning : isFinal ? t.finalWarning : t.standardWarning}
        </p>
        <div className="form-actions">
          <button className="secondary-button" onClick={onClose}>
            {t.keepWorking}
          </button>
          <button onClick={onConfirm} disabled={submitting}>
            {submitting ? strings.footer.submitting : continueToSpeaking ? t.continueToSpeaking : t.submitNow}
          </button>
        </div>
      </div>
    </div>
  );
}
