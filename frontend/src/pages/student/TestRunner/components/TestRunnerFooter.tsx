import { testRunnerStrings as strings } from "../TestRunner.strings";

interface TestRunnerFooterProps {
  answeredCount: number;
  totalQuestions: number;
  submitting: boolean;
  onRequestSubmit: () => void;
  continueToSpeaking?: boolean;
  /** Final Test only: the PeopleCert footer is a rule and one End Exam button. */
  languageCertSkin?: boolean;
  hideSubmit?: boolean;
}

export function TestRunnerFooter({
  answeredCount,
  totalQuestions,
  submitting,
  onRequestSubmit,
  continueToSpeaking = false,
  languageCertSkin = false,
  hideSubmit = false,
}: TestRunnerFooterProps) {
  const t = strings.footer;

  /* No answered count on the exam skin: the official platform never shows one,
     and it is the clearest tell that a candidate is not in the real delivery
     client. The confirmation modal still reports it before submission. */
  if (languageCertSkin) {
    if (hideSubmit) return null;
    return (
      <footer className="test-runner-footer lc-footer">
        <button className="lc-end-exam" onClick={onRequestSubmit} disabled={submitting}>
          {submitting ? t.submitting : continueToSpeaking ? t.continueToSpeaking : t.endExam}
        </button>
      </footer>
    );
  }

  return (
    <footer className="test-runner-footer">
      <span>{t.answeredOf(answeredCount, totalQuestions)}</span>
      <div>
        {/* Moving between parts is done from the header. This action either
            closes the main paper and opens Speaking, or submits a standalone
            assessment; both paths retain a confirmation step. */}
        {!hideSubmit && (
          <button className="test-runner-end-exam" onClick={onRequestSubmit} disabled={submitting}>
            {submitting ? t.submitting : continueToSpeaking ? t.continueToSpeaking : t.endExam}
          </button>
        )}
      </div>
    </footer>
  );
}
