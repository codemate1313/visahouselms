import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Attempt, ExamModuleType } from "@/api/types";
import { Icon } from "@/components/icons";

interface PreExamOnboardingProps {
  attempt: Attempt;
  secondsLeft: number;
  brandMark: ReactNode;
  testContext: string;
  securityError: string | null;
  securityStarting: boolean;
  concurrentTab: boolean;
  mediaState?: unknown;
  onStartSecureSession: () => void;
  onCancel: () => void;
}

export function PreExamOnboarding({
  attempt,
  secondsLeft,
  brandMark,
  testContext,
  securityError,
  securityStarting,
  concurrentTab,
  onStartSecureSession,
  onCancel,
}: PreExamOnboardingProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [confirmed, setConfirmed] = useState(false);

  // Audio / Mic testing state
  const [micTesting, setMicTesting] = useState(false);
  const [micTested, setMicTested] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Calculate dynamic metadata
  const totalQuestions = useMemo(() => {
    return attempt.parts.reduce((sum, p) => sum + (p.questions?.length || p.question_count || 0), 0);
  }, [attempt.parts]);

  const totalDurationMinutes = useMemo(() => {
    const sum = attempt.parts.reduce((acc, p) => acc + (p.duration_minutes || 0), 0);
    if (sum > 0) return sum;
    if (secondsLeft > 0) return Math.ceil(secondsLeft / 60);
    return 15;
  }, [attempt.parts, secondsLeft]);

  // Skill theme styling
  const skillMeta = useMemo(() => {
    const type: ExamModuleType = attempt.module_type || "speaking";
    switch (type) {
      case "listening":
        return {
          label: "Listening Test",
          icon: "module" as const,
          themeClass: "theme-listening",
          accentColor: "#2563eb",
          gradient: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
        };
      case "reading":
        return {
          label: "Reading Test",
          icon: "courses" as const,
          themeClass: "theme-reading",
          accentColor: "#7c3aed",
          gradient: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
        };
      case "writing":
        return {
          label: "Writing Test",
          icon: "edit" as const,
          themeClass: "theme-writing",
          accentColor: "#059669",
          gradient: "linear-gradient(135deg, #10b981 0%, #047857 100%)",
        };
      case "full_mock":
      case "final_test":
        return {
          label: type === "full_mock" ? "Full Mock Test" : "Official Exit Assessment",
          icon: "overview" as const,
          themeClass: "theme-mock",
          accentColor: "#e11d2e",
          gradient: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
        };
      case "speaking":
      default:
        return {
          label: "Speaking Test",
          icon: "microphone" as const,
          themeClass: "theme-speaking",
          accentColor: "#00a8cc",
          gradient: "linear-gradient(135deg, #00b4d8 0%, #0077b6 100%)",
        };
    }
  }, [attempt.module_type]);

  // Microphone tester
  const handleTestMic = async () => {
    if (micTesting) return;
    setMicTesting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((a, b) => a + b, 0);
        const avg = sum / dataArray.length;
        setVolumeLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
      setMicTested(true);

      // Stop test automatically after 4 seconds
      setTimeout(() => {
        stopMicTest();
      }, 4000);
    } catch {
      setMicTesting(false);
      setMicTested(false);
    }
  };

  const stopMicTest = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setMicTesting(false);
    setVolumeLevel(0);
  };

  useEffect(() => {
    return () => {
      stopMicTest();
    };
  }, []);

  return (
    <div className={`onboarding-wrapper ${skillMeta.themeClass}`}>
      {/* 1. Back Navigation Button */}
      <div className="onboarding-top-bar">
        <button type="button" className="onboarding-back-btn" onClick={onCancel}>
          <Icon name="chevronDown" style={{ transform: "rotate(90deg)" }} />
          <span>Back to Mock Tests</span>
        </button>
      </div>

      {/* 2. Hero Module Banner Card */}
      <div className="onboarding-hero-card" style={{ background: skillMeta.gradient }}>
        <div className="onboarding-hero-badge">
          <Icon name={skillMeta.icon} />
          <span>{skillMeta.label}</span>
        </div>

        <h1 className="onboarding-hero-title">{attempt.module_title}</h1>

        <div className="onboarding-hero-meta">
          <div className="onboarding-meta-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>{totalDurationMinutes} minutes</span>
          </div>
          <div className="onboarding-meta-pill">
            <Icon name="help" />
            <span>{totalQuestions} questions</span>
          </div>
          <div className="onboarding-meta-pill">
            <Icon name="overview" />
            <span>{attempt.parts.length} {attempt.parts.length === 1 ? "section" : "sections"}</span>
          </div>
          <div className="onboarding-meta-pill">
            <Icon name="user" />
            <span>{testContext}</span>
            {brandMark && <span className="onboarding-brand-mark">{brandMark}</span>}
          </div>
        </div>
      </div>

      {/* 3. 4-Step Stepper Navigation Bar */}
      <div className="onboarding-stepper-bar">
        <button
          type="button"
          className={`onboarding-step-tab ${step === 1 ? "is-active" : step > 1 ? "is-complete" : ""}`}
          onClick={() => setStep(1)}
        >
          <span className="step-num">{step > 1 ? "✓" : "1"}</span>
          <span className="step-label">Instructions</span>
        </button>

        <button
          type="button"
          className={`onboarding-step-tab ${step === 2 ? "is-active" : step > 2 ? "is-complete" : ""}`}
          onClick={() => setStep(2)}
        >
          <span className="step-num">{step > 2 ? "✓" : "2"}</span>
          <span className="step-label">Test Overview</span>
        </button>

        <button
          type="button"
          className={`onboarding-step-tab ${step === 3 ? "is-active" : step > 3 ? "is-complete" : ""}`}
          onClick={() => setStep(3)}
        >
          <span className="step-num">{step > 3 ? "✓" : "3"}</span>
          <span className="step-label">Equipment Check</span>
        </button>

        <button
          type="button"
          className={`onboarding-step-tab ${step === 4 ? "is-active" : ""}`}
          onClick={() => setStep(4)}
        >
          <span className="step-num">4</span>
          <span className="step-label">Begin</span>
        </button>
      </div>

      {/* 4. Active Step Content Card */}
      <div className="onboarding-card-body">
        {/* STEP 1: INSTRUCTIONS */}
        {step === 1 && (
          <div className="onboarding-step-content">
            <div className="onboarding-card-header">
              <Icon name="check" className="onboarding-card-icon" />
              <h2>Exam Rules & Instructions</h2>
            </div>

            <div className="onboarding-rules-list">
              <div className="onboarding-rule-item">
                <div className="rule-icon-box icon-blue">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <div className="rule-text">
                  <strong>Timed Exam — {totalDurationMinutes} minutes.</strong> The timer starts as soon as you click "Start Exam". The test will auto-submit when time runs out.
                </div>
              </div>

              <div className="onboarding-rule-item">
                <div className="rule-icon-box icon-green">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/></svg>
                </div>
                <div className="rule-text">
                  <strong>Auto-save enabled.</strong> Your answers are automatically saved every 30 seconds. If you lose connection, your progress is safe.
                </div>
              </div>

              <div className="onboarding-rule-item">
                <div className="rule-icon-box icon-amber">
                  <Icon name="logout" />
                </div>
                <div className="rule-text">
                  <strong>Pause & Resume.</strong> You can exit anytime using the Exit button. The timer continues, but your answers are saved for when you return.
                </div>
              </div>

              {(attempt.module_type === "speaking" || attempt.module_type === "listening" || attempt.module_type === "full_mock") && (
                <div className="onboarding-rule-item">
                  <div className="rule-icon-box icon-cyan">
                    <Icon name="microphone" />
                  </div>
                  <div className="rule-text">
                    <strong>Microphone & Audio required.</strong> You'll need to allow browser access to your microphone or headphones. Audio responses are recorded and uploaded automatically.
                  </div>
                </div>
              )}

              <div className="onboarding-rule-item">
                <div className="rule-icon-box icon-purple">
                  <Icon name="restore" />
                </div>
                <div className="rule-text">
                  <strong>Navigate freely.</strong> Use the Next/Previous buttons to move between sections. The question navigator lets you jump to any question.
                </div>
              </div>
            </div>

            {/* Candidate Instructions from Instructor (if specified) */}
            {attempt.parts.some((p) => p.instructions) && (
              <div className="onboarding-instructor-notes-box">
                <div className="notes-header">
                  <Icon name="edit" />
                  <strong>Instructor Notes & Specific Guidance</strong>
                </div>
                <div className="notes-body">
                  {attempt.parts.map((p, idx) => (
                    p.instructions ? (
                      <p key={p.id}>
                        <strong>Part {idx + 1}:</strong> {p.instructions}
                      </p>
                    ) : null
                  ))}
                </div>
              </div>
            )}

            <div className="onboarding-actions-row flex-end">
              <button
                type="button"
                className="onboarding-primary-btn"
                onClick={() => setStep(2)}
              >
                <span>Next: Test Overview</span>
                <Icon name="chevronDown" style={{ transform: "rotate(-90deg)" }} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: TEST OVERVIEW */}
        {step === 2 && (
          <div className="onboarding-step-content">
            <div className="onboarding-card-header">
              <Icon name="overview" className="onboarding-card-icon" />
              <h2>Test Structure — {attempt.parts.length} {attempt.parts.length === 1 ? "Section" : "Sections"}</h2>
            </div>

            <div className="onboarding-parts-grid">
              {attempt.parts.map((part, index) => {
                const qCount = part.questions?.length || part.question_count || 0;
                return (
                  <div className="onboarding-part-card" key={part.id}>
                    <div className="part-num-badge">{index + 1}</div>
                    <div className="part-card-info">
                      <h3>Part {index + 1}</h3>
                      <p>
                        {qCount} {qCount === 1 ? "question" : "questions"} · {part.section_type ? part.section_type.toUpperCase() : "GENERAL"}
                      </p>
                    </div>
                    <div className="part-q-tag">{qCount}Q</div>
                  </div>
                );
              })}
            </div>

            <div className="onboarding-summary-banner">
              <Icon name="help" />
              <span>
                Total: <strong>{totalQuestions} questions</strong> across <strong>{attempt.parts.length} sections</strong>. Time limit: <strong>{totalDurationMinutes} minutes</strong>.
              </span>
            </div>

            <div className="onboarding-actions-row space-between">
              <button
                type="button"
                className="onboarding-secondary-btn"
                onClick={() => setStep(1)}
              >
                <span>← Back</span>
              </button>
              <button
                type="button"
                className="onboarding-primary-btn"
                onClick={() => setStep(3)}
              >
                <span>Next: Equipment Check</span>
                <Icon name="chevronDown" style={{ transform: "rotate(-90deg)" }} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: EQUIPMENT CHECK */}
        {step === 3 && (
          <div className="onboarding-step-content">
            <div className="onboarding-card-header">
              <Icon name="settings" className="onboarding-card-icon" />
              <h2>System & Equipment Check</h2>
            </div>

            <div className="onboarding-equipment-list">
              <div className="equipment-row">
                <div className="equipment-info">
                  <div className="equipment-icon-box">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  </div>
                  <div>
                    <strong>Browser</strong>
                    <p>{navigator.userAgent.includes("Chrome") ? "Google Chrome" : navigator.userAgent.includes("Safari") ? "Apple Safari" : "Standard Web Browser"}</p>
                  </div>
                </div>
                <span className="equipment-status-badge status-green">Supported</span>
              </div>

              <div className="equipment-row">
                <div className="equipment-info">
                  <div className="equipment-icon-box">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
                  </div>
                  <div>
                    <strong>Internet Connection</strong>
                    <p>Connected & Active</p>
                  </div>
                </div>
                <span className="equipment-status-badge status-green">Connected</span>
              </div>

              <div className="equipment-row">
                <div className="equipment-info">
                  <div className="equipment-icon-box">
                    <Icon name="microphone" />
                  </div>
                  <div>
                    <strong>Microphone & Audio Output</strong>
                    <p>Required for test audio and voice recording</p>
                  </div>
                </div>
                <span className={`equipment-status-badge ${micTested ? "status-green" : "status-amber"}`}>
                  {micTested ? "Tested & Ready" : "Not tested"}
                </span>
              </div>
            </div>

            {/* Interactive Audio Tester Container */}
            <div className="onboarding-mic-tester-container">
              <Icon name="microphone" className="mic-tester-large-icon" />
              <p className="mic-tester-hint">Click to test your microphone</p>

              <button
                type="button"
                className={`onboarding-test-mic-btn ${micTesting ? "is-testing" : ""}`}
                onClick={handleTestMic}
              >
                <Icon name="microphone" />
                <span>{micTesting ? "Testing Microphone..." : micTested ? "Re-test Microphone" : "Test Microphone"}</span>
              </button>

              {micTesting && (
                <div className="mic-volume-meter-bar">
                  <div className="mic-volume-meter-fill" style={{ width: `${Math.max(15, volumeLevel)}%` }} />
                </div>
              )}
            </div>

            <div className="onboarding-actions-row space-between">
              <button
                type="button"
                className="onboarding-secondary-btn"
                onClick={() => setStep(2)}
              >
                <span>← Back</span>
              </button>
              <button
                type="button"
                className="onboarding-primary-btn"
                onClick={() => setStep(4)}
              >
                <span>Next: Ready to Begin</span>
                <Icon name="chevronDown" style={{ transform: "rotate(-90deg)" }} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: BEGIN */}
        {step === 4 && (
          <div className="onboarding-step-content text-center">
            <div className="onboarding-rocket-badge">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.71.12-1.67-.32-2.12a2.03 2.03 0 0 0-2.68-.38z"/><path d="M12 15l-3-3 7.35-7.35a4.5 4.5 0 0 1 6.36 6.36L12 15z"/><path d="M16.5 4.5L19.5 7.5"/></svg>
            </div>

            <h2 className="onboarding-ready-heading">Ready to Start Your Exam</h2>
            <p className="onboarding-ready-desc">
              You are about to begin <strong>{attempt.module_title}</strong>. The timer will start immediately. Make sure you are in a quiet environment and ready to focus.
            </p>

            <div className="onboarding-stat-summary-row">
              <div className="stat-box">
                <strong>{totalDurationMinutes}</strong>
                <span>minutes</span>
              </div>
              <div className="stat-box">
                <strong>{totalQuestions}</strong>
                <span>questions</span>
              </div>
              <div className="stat-box">
                <strong>{attempt.parts.length}</strong>
                <span>{attempt.parts.length === 1 ? "section" : "sections"}</span>
              </div>
            </div>

            <label className="onboarding-consent-card">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>
                I confirm that I have read the instructions, checked my equipment, and I am ready to begin. I understand that the timer starts immediately and cannot be paused.
              </span>
            </label>

            {securityError && <p className="onboarding-security-error">{securityError}</p>}
            {concurrentTab && <p className="onboarding-security-error">Another test session is active in another tab.</p>}

            <div className="onboarding-actions-row center-actions">
              <button
                type="button"
                className="onboarding-start-exam-btn"
                disabled={!confirmed || securityStarting || concurrentTab}
                onClick={onStartSecureSession}
              >
                <Icon name="play" />
                <span>{securityStarting ? "Initializing Test..." : "Start Exam"}</span>
              </button>
            </div>

            <p className="onboarding-good-luck">Good luck! 🎯</p>

            <div className="onboarding-actions-row space-between" style={{ marginTop: 24 }}>
              <button
                type="button"
                className="onboarding-secondary-btn"
                onClick={() => setStep(3)}
              >
                <span>← Back</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
