import type { ReactNode, RefObject } from "react";
import type { Attempt } from "@/api/types";
import type { SecurityMediaState } from "../helpers";
import { formatTime } from "../helpers";
import { testRunnerStrings as strings } from "../TestRunner.strings";
import { SecurityCheck } from "./SecurityCheck";

interface SecurityCheckPageProps {
  attempt: Attempt;
  brandedTestClass: string;
  brandMark: ReactNode;
  testContext: string;
  secondsLeft: number;
  mediaState: SecurityMediaState;
  cameraPreviewRef: RefObject<HTMLVideoElement | null>;
  concurrentTab: boolean;
  securityError: string | null;
  securityStarting: boolean;
  mediaPermissionsReady: boolean;
  fullscreenActive: boolean;
  rulesAccepted: boolean;
  onRulesAcceptedChange: (accepted: boolean) => void;
  onStartSecureSession: () => void;
}

export function SecurityCheckPage({
  attempt,
  brandedTestClass,
  brandMark,
  testContext,
  secondsLeft,
  mediaState,
  cameraPreviewRef,
  concurrentTab,
  securityError,
  securityStarting,
  mediaPermissionsReady,
  fullscreenActive,
  rulesAccepted,
  onRulesAcceptedChange,
  onStartSecureSession,
}: SecurityCheckPageProps) {
  const t = strings.security;

  return (
    <div className={`test-security-page${brandedTestClass}`}>
      <header className="test-security-header">
        <div className="test-runner-brand">
          <span className="test-runner-brand-mark">{brandMark}</span>
          <div>
            <h1>{attempt.module_title}</h1>
            <p>
              {testContext} · {t.securityCheckContext}
            </p>
          </div>
        </div>
        {attempt.status === "in_progress" && (
          <div className={`test-runner-timer${secondsLeft < 300 ? " is-urgent" : ""}`}>
            <span>{t.timeLeft}</span>
            <strong>{formatTime(secondsLeft)}</strong>
          </div>
        )}
      </header>
      <main className="test-security-main">
        <section className="test-security-card" aria-labelledby="security-check-title">
          <div className="test-security-copy">
            <span className="page-eyebrow">{t.eyebrow}</span>
            <h2 id="security-check-title">{t.heading}</h2>
            <p>{t.description}</p>
          </div>

          <div className="test-security-content">
            <div className="test-security-preview">
              <video ref={cameraPreviewRef} muted playsInline aria-label={t.cameraPreviewAlt} />
              <span>{mediaState.camera ? t.cameraActive : t.cameraPreview}</span>
            </div>
            <div className="test-security-checks" aria-label={t.checksAriaLabel}>
              <SecurityCheck label={t.camera} active={mediaState.camera} />
              <SecurityCheck label={t.microphone} active={mediaState.microphone} />
              <SecurityCheck label={t.fullScreen} active={mediaState.fullscreen} />
            </div>
          </div>

          {concurrentTab && <p className="test-security-alert">{t.concurrentTabAlert}</p>}
          {securityError && <p className="test-security-alert">{securityError}</p>}
          <div className="test-security-rules">
            <strong>{t.rulesHeading}</strong>
            <ul>
              {t.rules.map((rule) => <li key={rule}>{rule}</li>)}
            </ul>
            <label className="test-security-consent">
              <input
                type="checkbox"
                checked={rulesAccepted}
                onChange={(event) => onRulesAcceptedChange(event.target.checked)}
              />
              <span>{t.consentLabel}</span>
            </label>
          </div>
          <p className="test-security-privacy">{t.privacyNote}</p>
          <div className="test-security-actions">
            <button type="button" onClick={onStartSecureSession} disabled={securityStarting || concurrentTab || !rulesAccepted}>
              {securityStarting
                ? t.activating
                : mediaPermissionsReady && !fullscreenActive
                  ? t.enterFullscreenAndContinue
                  : attempt.status === "ready"
                    ? t.enableAllAndStart
                    : t.enableAllAndRestore}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
