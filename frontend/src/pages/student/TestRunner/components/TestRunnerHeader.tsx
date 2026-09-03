import type { ReactNode } from "react";
import type { Attempt } from "@/api/types";
import { useAuthStore } from "@/store/authStore";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/Button/Button";
import { testRunnerStrings as strings } from "../TestRunner.strings";
import { buildExamUrn, formatTime, languageCertHeaderTitle } from "../helpers";
import { LcClockIcon, PeopleCertBrand } from "./PeopleCertBrand";

interface TestRunnerHeaderProps {
  attempt: Attempt;
  currentPart: Attempt["parts"][number];
  brandMark: ReactNode;
  testContext: string;
  isFinalAttempt: boolean;
  partIndex: number;
  onSelectPart: (index: number) => void;
  previousPartIndex?: number | null;
  nextPartIndex?: number | null;
  onRequestSubmit: () => void;
  submitting?: boolean;
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
  previousPartIndex,
  nextPartIndex,
  onRequestSubmit,
  submitting = false,
  onSkipPart,
  isNavigationLocked = false,
  isImmersiveAttempt,
  fullscreenActive,
  onExitDeveloperFullscreen,
  secondsLeft,
  languageCertSkin = false,
  timerVisible = true,
}: TestRunnerHeaderProps) {
  const user = useAuthStore((state) => state.user);
  const t = strings.header;
  const sectionLabels = strings.sectionLabels;
  const previousTarget = previousPartIndex !== undefined
    ? previousPartIndex
    : (partIndex > 0 ? partIndex - 1 : null);
  const nextTarget = nextPartIndex !== undefined
    ? nextPartIndex
    : (partIndex < attempt.parts.length - 1 ? partIndex + 1 : null);
  const isFinalSegment = nextTarget === null;

  const developerTools = (
    <>
      {/* Testing aid: the lock exists so a candidate cannot skip a recording,
          so this deliberately overrides it - and only in development. */}
      {import.meta.env.DEV && onSkipPart && (
        <Button
          type="button"
          variant="secondary"
          className="test-runner-dev-exit"
          onClick={onSkipPart}
          disabled={partIndex >= attempt.parts.length - 1}
        >
          {t.devSkipPart}
        </Button>
      )}
      {import.meta.env.DEV && isImmersiveAttempt && fullscreenActive && (
        <Button type="button" variant="secondary" className="test-runner-dev-exit" onClick={onExitDeveloperFullscreen}>
          {t.devExitFullscreen}
        </Button>
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

    const urn = buildExamUrn(attempt, user?.id).split("/").pop() ?? "";

    return (
      <header className="test-runner-header lc-header">
        <div className="lc-header-inner">
          <PeopleCertBrand />
          {/* The equal outer grid columns keep this title centred without
              allowing it to overlap the brand or the optional timer. */}
          <div className="lc-header-center">
            <h1 className="lc-header-title">{languageCertHeaderTitle(currentPart.section_type)}</h1>
            <div className="lc-header-urn">{urn}</div>
          </div>
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
          <Button
            type="button"
            variant="secondary"
            className="secondary-button"
            disabled={previousTarget === null || isNavigationLocked}
            onClick={() => {
              if (previousTarget !== null) onSelectPart(previousTarget);
            }}
            title={isNavigationLocked ? t.navigationLocked : undefined}
          >
            {t.previous}
          </Button>
          <Button
            type="button"
            disabled={isNavigationLocked || submitting}
            onClick={() => {
              if (nextTarget !== null) {
                onSelectPart(nextTarget);
              } else {
                onRequestSubmit();
              }
            }}
            title={isNavigationLocked ? t.navigationLocked : undefined}
          >
            {submitting ? strings.footer.submitting : isFinalSegment ? strings.footer.submitTest : t.next}
          </Button>
        </div>
        {developerTools}
      </div>
    </header>
  );
}
