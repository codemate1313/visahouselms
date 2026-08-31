import { formatTime } from "../helpers";
import { testRunnerStrings as strings } from "../TestRunner.strings";
import { Button } from "@/components/ui/Button/Button";

interface FullscreenGateProps {
  isFinal: boolean;
  secondsLeft: number;
  onEnterFullscreen: () => void;
  /** Matches the header: no clock on the sections that do not show one. */
  timerVisible?: boolean;
  /** Set when the browser rejected the last fullscreen request. Rendered here,
      persistently, rather than only as a toast - the toast fades and leaves a
      candidate stuck on this gate with no visible reason the button isn't
      working. */
  securityError?: string | null;
  missingControls?: string[];
  restoring?: boolean;
}

export function FullscreenGate({
  isFinal,
  secondsLeft,
  onEnterFullscreen,
  timerVisible = true,
  securityError = null,
  missingControls = [],
  restoring = false,
}: FullscreenGateProps) {
  const t = strings.fullscreenGate;
  const isRestoreGate = missingControls.length > 0;
  return (
    <div className="test-runner-fullscreen-gate" role="dialog" aria-modal="true" aria-labelledby="fullscreen-gate-title">
      <section>
        <span className="page-eyebrow">{isFinal ? t.finalTest : t.fullMockTest}</span>
        <h2 id="fullscreen-gate-title">{isRestoreGate ? t.restoreHeading : t.heading}</h2>
        <p>{isRestoreGate ? t.restoreDescription : t.description}</p>
        {isRestoreGate && (
          <div className="test-runner-gate-checks" aria-label="Missing security controls">
            {missingControls.map((control) => (
              <span key={control}>{control}</span>
            ))}
          </div>
        )}
        {/* The gate can cover a Listening or Speaking part, and printing the
            remaining time here would hand back exactly what the header is
            withholding a few pixels away. */}
        {timerVisible && (
          <div className={`test-runner-gate-timer${secondsLeft < 300 ? " is-urgent" : ""}`}>{formatTime(secondsLeft)}</div>
        )}
        {securityError && (
          <p className="test-runner-gate-error" role="alert">{securityError}</p>
        )}
        <Button type="button" onClick={onEnterFullscreen} disabled={restoring}>
          {restoring ? strings.security.activating : isRestoreGate ? t.restoreControls : t.enterFullscreen}
        </Button>
      </section>
    </div>
  );
}
