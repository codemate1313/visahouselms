import { formatTime } from "../helpers";
import { testRunnerStrings as strings } from "../TestRunner.strings";

interface FullscreenGateProps {
  isFinal: boolean;
  secondsLeft: number;
  onEnterFullscreen: () => void;
  /** Matches the header: no clock on the sections that do not show one. */
  timerVisible?: boolean;
}

export function FullscreenGate({ isFinal, secondsLeft, onEnterFullscreen, timerVisible = true }: FullscreenGateProps) {
  const t = strings.fullscreenGate;
  return (
    <div className="test-runner-fullscreen-gate" role="dialog" aria-modal="true" aria-labelledby="fullscreen-gate-title">
      <section>
        <span className="page-eyebrow">{isFinal ? t.finalTest : t.fullMockTest}</span>
        <h2 id="fullscreen-gate-title">{t.heading}</h2>
        <p>{t.description}</p>
        {/* The gate can cover a Listening or Speaking part, and printing the
            remaining time here would hand back exactly what the header is
            withholding a few pixels away. */}
        {timerVisible && (
          <div className={`test-runner-gate-timer${secondsLeft < 300 ? " is-urgent" : ""}`}>{formatTime(secondsLeft)}</div>
        )}
        <button type="button" onClick={onEnterFullscreen}>
          {t.enterFullscreen}
        </button>
      </section>
    </div>
  );
}
