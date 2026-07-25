import { formatTime } from "../helpers";
import { testRunnerStrings as strings } from "../TestRunner.strings";

interface FullscreenGateProps {
  isFinal: boolean;
  secondsLeft: number;
  onEnterFullscreen: () => void;
}

export function FullscreenGate({ isFinal, secondsLeft, onEnterFullscreen }: FullscreenGateProps) {
  const t = strings.fullscreenGate;
  return (
    <div className="test-runner-fullscreen-gate" role="dialog" aria-modal="true" aria-labelledby="fullscreen-gate-title">
      <section>
        <span className="page-eyebrow">{isFinal ? t.finalTest : t.fullMockTest}</span>
        <h2 id="fullscreen-gate-title">{t.heading}</h2>
        <p>{t.description}</p>
        <div className={`test-runner-gate-timer${secondsLeft < 300 ? " is-urgent" : ""}`}>{formatTime(secondsLeft)}</div>
        <button type="button" onClick={onEnterFullscreen}>
          {t.enterFullscreen}
        </button>
      </section>
    </div>
  );
}
