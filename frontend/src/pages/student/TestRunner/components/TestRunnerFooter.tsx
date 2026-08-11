import { testRunnerStrings as strings } from "../TestRunner.strings";

interface TestRunnerFooterProps {
  answeredCount: number;
  totalQuestions: number;
  partIndex: number;
  isLastPart: boolean;
  submitting: boolean;
  onSelectPart: (index: number) => void;
  onRequestSubmit: () => void;
  isListeningLocked?: boolean;
}

export function TestRunnerFooter({
  answeredCount,
  totalQuestions,
  partIndex,
  isLastPart,
  submitting,
  onSelectPart,
  onRequestSubmit,
  isListeningLocked = false,
}: TestRunnerFooterProps) {
  const t = strings.footer;
  return (
    <footer className="test-runner-footer">
      <span>{t.answeredOf(answeredCount, totalQuestions)}</span>
      <div>
        <button
          className="secondary-button"
          disabled={partIndex === 0 || isListeningLocked}
          onClick={() => onSelectPart(partIndex - 1)}
          title={isListeningLocked ? "Navigation locked during listening section audio" : undefined}
        >
          {t.previousPart}
        </button>
        {!isLastPart ? (
          <button
            disabled={isListeningLocked}
            onClick={() => onSelectPart(partIndex + 1)}
            title={isListeningLocked ? "Navigation locked during listening section audio" : undefined}
          >
            {t.nextPart}
          </button>
        ) : (
          <button onClick={onRequestSubmit} disabled={submitting}>
            {submitting ? t.submitting : t.submitTest}
          </button>
        )}
      </div>
    </footer>
  );
}
