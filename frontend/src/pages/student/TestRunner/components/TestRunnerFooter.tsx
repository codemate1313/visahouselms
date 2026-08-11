import { testRunnerStrings as strings } from "../TestRunner.strings";

interface TestRunnerFooterProps {
  answeredCount: number;
  totalQuestions: number;
  submitting: boolean;
  onRequestSubmit: () => void;
}

export function TestRunnerFooter({
  answeredCount,
  totalQuestions,
  submitting,
  onRequestSubmit,
}: TestRunnerFooterProps) {
  const t = strings.footer;
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
