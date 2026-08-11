import type { ReactNode } from "react";
import type { Attempt } from "@/api/types";
import { formatTime } from "../helpers";
import { testRunnerStrings as strings } from "../TestRunner.strings";

interface TestRunnerHeaderProps {
  attempt: Attempt;
  currentPart: Attempt["parts"][number];
  brandMark: ReactNode;
  testContext: string;
  isFinalAttempt: boolean;
  partIndex: number;
  onSelectPart: (index: number) => void;
  isImmersiveAttempt: boolean;
  fullscreenActive: boolean;
  onExitDeveloperFullscreen: () => void;
  secondsLeft: number;
  isListeningLocked?: boolean;
}

export function TestRunnerHeader({
  attempt,
  currentPart,
  brandMark,
  testContext: _testContext,
  isFinalAttempt,
  partIndex,
  onSelectPart,
  isImmersiveAttempt,
  fullscreenActive,
  onExitDeveloperFullscreen,
  secondsLeft,
  isListeningLocked = false,
}: TestRunnerHeaderProps) {
  const t = strings.header;
  const sectionLabels = strings.sectionLabels;

  return (
    <header className="test-runner-header">
      <div className="test-runner-brand">
        <span className="test-runner-brand-mark">{brandMark}</span>
        <div>
          <h1>{attempt.module_title}</h1>
          <p>{sectionLabels[currentPart.section_type as keyof typeof sectionLabels] || currentPart.section_type}</p>
        </div>
      </div>
      <div className="test-runner-header-actions">
        {isFinalAttempt && (
          <div className="test-security-live" title={t.secureBadgeTitle}>
            <span /> {t.secureBadge}
          </div>
        )}
        <div className="test-runner-header-navigation" aria-label={t.partNavigationAriaLabel}>
          <button
            type="button"
            className="secondary-button"
            disabled={partIndex === 0 || isListeningLocked}
            onClick={() => onSelectPart(partIndex - 1)}
            title={isListeningLocked ? "Navigation locked during listening section audio" : undefined}
          >
            {t.previous}
          </button>
          <button
            type="button"
            disabled={partIndex === attempt.parts.length - 1 || isListeningLocked}
            onClick={() => onSelectPart(partIndex + 1)}
            title={isListeningLocked ? "Navigation locked during listening section audio" : undefined}
          >
            {t.next}
          </button>
        </div>
        {import.meta.env.DEV && isImmersiveAttempt && fullscreenActive && (
          <button type="button" className="test-runner-dev-exit" onClick={onExitDeveloperFullscreen}>
            {t.devExitFullscreen}
          </button>
        )}
        <div className={`test-runner-timer${secondsLeft < 300 ? " is-urgent" : ""}`} aria-label="Time remaining">
          <span>{strings.security.timeLeft}</span>
          <strong>{formatTime(secondsLeft)}</strong>
        </div>
      </div>
    </header>
  );
}
