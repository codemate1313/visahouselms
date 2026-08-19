import { testRunnerStrings as strings } from "../TestRunner.strings";

interface TestRunnerFooterProps {
  answeredCount: number;
  totalQuestions: number;
  submitting: boolean;
  onRequestSubmit: () => void;
  /** Final Test only: the PeopleCert footer is a rule and one End Exam button. */
  languageCertSkin?: boolean;
}

export function TestRunnerFooter({
  answeredCount,
  totalQuestions,
  submitting,
  onRequestSubmit,
  languageCertSkin = false,
}: TestRunnerFooterProps) {
  const t = strings.footer;

  /* No answered count on the exam skin: the official platform never shows one,
     and it is the clearest tell that a candidate is not in the real delivery
     client. The confirmation modal still reports it before submission. */
  if (languageCertSkin) {
    return (
      <footer className="test-runner-footer lc-footer">
        <button className="lc-end-exam" onClick={onRequestSubmit} disabled={submitting}>
          {submitting ? t.submitting : t.endExam}
        </button>
      </footer>
    );
  }

  return (
    <footer className="test-runner-footer">
      <span>{t.answeredOf(answeredCount, totalQuestions)}</span>
      <div>
        {/* Moving between parts is done from the header. The one action down
            here ends the attempt, and it still goes through the confirmation
            modal - this button submits the whole test. */}
        <button className="test-runner-end-exam" onClick={onRequestSubmit} disabled={submitting}>
          {submitting ? t.submitting : t.endExam}
        </button>
      </div>
    </footer>
  );
}
