import type { ReactNode } from "react";
import type { Attempt } from "@/api/types";
import { testRunnerStrings as strings } from "../TestRunner.strings";

interface TestRunnerHeaderProps {
  attempt: Attempt;
  currentPart: Attempt["parts"][number];
  brandMark: ReactNode;
  testContext: string;
  isFinalAttempt: boolean;
  partIndex: number;
  onSelectPart: (index: number) => void;
  /** Jumps to the next part even while audio holds the part locked. */
  onSkipPart?: () => void;
  isListeningLocked?: boolean;
  isImmersiveAttempt: boolean;
  fullscreenActive: boolean;
  onExitDeveloperFullscreen: () => void;
}

export function TestRunnerHeader({
  attempt,
  currentPart,
  brandMark,
  testContext: _testContext,
  isFinalAttempt,
  partIndex,
  onSelectPart,
  onSkipPart,
  isListeningLocked = false,
  isImmersiveAttempt,
  fullscreenActive,
  onExitDeveloperFullscreen,
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
            title={isListeningLocked ? t.navigationLocked : undefined}
          >
            {t.previous}
          </button>
          <button
            type="button"
            disabled={partIndex === attempt.parts.length - 1 || isListeningLocked}
            onClick={() => onSelectPart(partIndex + 1)}
            title={isListeningLocked ? t.navigationLocked : undefined}
          >
            {t.next}
          </button>
        </div>
        {/* Testing aid: the lock exists so a candidate cannot skip a recording,
            so this deliberately overrides it - and only in development. */}
        {import.meta.env.DEV && onSkipPart && (
          <button
            type="button"
            className="test-runner-dev-exit"
            onClick={onSkipPart}
            disabled={partIndex >= attempt.parts.length - 1}
          >
            {t.devSkipPart}
          </button>
        )}
        {import.meta.env.DEV && isImmersiveAttempt && fullscreenActive && (
          <button type="button" className="test-runner-dev-exit" onClick={onExitDeveloperFullscreen}>
            {t.devExitFullscreen}
          </button>
        )}
      </div>
    </header>
  );
}
