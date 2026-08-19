import type { ReactNode } from "react";
import type { Attempt } from "@/api/types";
import { ThemeToggle } from "@/components/ThemeToggle";
import { testRunnerStrings as strings } from "../TestRunner.strings";
import { formatTime, languageCertHeaderTitle } from "../helpers";
import { LcClockIcon, PeopleCertBrand } from "./PeopleCertBrand";

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
  isNavigationLocked?: boolean;
  isImmersiveAttempt: boolean;
  fullscreenActive: boolean;
  onExitDeveloperFullscreen: () => void;
  secondsLeft?: number;
  /** Final Test only: the PeopleCert exam header replaces the standard one. */
  languageCertSkin?: boolean;
  /** Whether this part is one the countdown is shown on (Reading / Writing). */
  timerVisible?: boolean;
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
  isNavigationLocked = false,
  isImmersiveAttempt,
  fullscreenActive,
  onExitDeveloperFullscreen,
  secondsLeft,
  languageCertSkin = false,
  timerVisible = true,
}: TestRunnerHeaderProps) {
  const t = strings.header;
  const sectionLabels = strings.sectionLabels;

  const developerTools = (
    <>
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
    </>
  );

  /* The exam header is a fixed three-column lockup - brand, centred test name,
     countdown - with no part navigation in it: on this platform the candidate
     moves between parts from the sidebar and the in-page Previous/Next pair.
     Whether the countdown appears at all is decided by the runner - see
     `showsSectionTimer` - not by this component. */
  if (languageCertSkin) {
    const showTimer = attempt.status === "in_progress"
      && secondsLeft !== undefined
      && secondsLeft > 0
      && timerVisible;

    return (
      <header className="test-runner-header lc-header">
        <div className="lc-header-inner">
          <PeopleCertBrand />
          <h1 className="lc-header-title">{languageCertHeaderTitle(currentPart.section_type)}</h1>
          <div className="lc-header-right">
            {showTimer && (
              <div
                className={`lc-timer${secondsLeft < 300 ? " is-urgent" : ""}`}
                role="timer"
                aria-live="polite"
                aria-label={t.timeLeft || "Time Left"}
              >
                <span>{formatTime(secondsLeft)}</span>
                <LcClockIcon />
              </div>
            )}
            {developerTools}
          </div>
        </div>
      </header>
    );
  }

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
        <ThemeToggle className="test-runner-theme-toggle" />
        {attempt.status === "in_progress" && secondsLeft !== undefined && secondsLeft > 0 && timerVisible && (
          <div className={`test-runner-timer${secondsLeft < 300 ? " is-urgent" : ""}`} role="timer" aria-live="polite">
            <span>{t.timeLeft || "Time Left"}</span>
            <strong>{formatTime(secondsLeft)}</strong>
          </div>
        )}
        {isFinalAttempt && (
          <div className="test-security-live" title={t.secureBadgeTitle}>
            <span /> {t.secureBadge}
          </div>
        )}
        <div className="test-runner-header-navigation" aria-label={t.partNavigationAriaLabel}>
          <button
            type="button"
            className="secondary-button"
            disabled={partIndex === 0 || isNavigationLocked}
            onClick={() => onSelectPart(partIndex - 1)}
            title={isNavigationLocked ? t.navigationLocked : undefined}
          >
            {t.previous}
          </button>
          <button
            type="button"
            disabled={partIndex === attempt.parts.length - 1 || isNavigationLocked}
            onClick={() => onSelectPart(partIndex + 1)}
            title={isNavigationLocked ? t.navigationLocked : undefined}
          >
            {t.next}
          </button>
        </div>
        {developerTools}
      </div>
    </header>
  );
}
