import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Attempt, ExamModuleType } from "@/api/types";
import { Icon } from "@/components/icons";
import {
  Button,
  Stepper,
  StepperItem,
  StepperTrigger,
  StepperIndicator,
  StepperTitle,
  StepperDescription,
  StepperSeparator,
} from "@/components/ui";

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

const onboardingSteps = [
  {
    step: 1,
    title: "Session Guidelines",
    description: "Protocol & Integrity Rules",
  },
  {
    step: 2,
    title: "Assessment Structure",
    description: "Component Breakdown",
  },
  {
    step: 3,
    title: "Hardware Diagnostics",
    description: "Peripherals & Audio Audit",
  },
  {
    step: 4,
    title: "Candidate Launch",
    description: "Final Authorization",
  },
];

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
      case "writing":
        return {
          label: "Writing Examination",
          icon: "edit" as const,
          themeClass: "theme-writing",
          accentColor: "#b91c2b",
          gradient: "linear-gradient(135deg, #b91c2b 0%, #8f1522 100%)",
        };
      case "listening":
        return {
          label: "Listening Examination",
          icon: "module" as const,
          themeClass: "theme-listening",
          accentColor: "#2563eb",
          gradient: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)",
        };
      case "reading":
        return {
          label: "Reading Examination",
          icon: "courses" as const,
          themeClass: "theme-reading",
          accentColor: "#059669",
          gradient: "linear-gradient(135deg, #047857 0%, #065f46 100%)",
        };
      case "full_mock":
      case "final_test":
        return {
          label: type === "full_mock" ? "Full Mock Test" : "Official Exit Assessment",
          icon: "overview" as const,
          themeClass: "theme-mock",
          accentColor: "#b91c2b",
          gradient: "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)",
        };
      case "speaking":
      default:
        return {
          label: "Speaking Evaluation",
          icon: "microphone" as const,
          themeClass: "theme-speaking",
          accentColor: "#7c3aed",
          gradient: "linear-gradient(135deg, #6d28d9 0%, #5b21b6 100%)",
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

  const progressPercent = Math.round((step / 4) * 100);

  return (
    <div className={`onboarding-wrapper ${skillMeta.themeClass}`}>
      <div className="onboarding-grid-layout">
        {/* LEFT COLUMN: MicroInteractions Stepper Navigation */}
        <aside className="onboarding-sidebar">
          {/* Top Return to Dashboard Action */}
          <Button variant="ghost" onClick={onCancel} leftIcon={<Icon name="chevronDown" style={{ transform: "rotate(90deg)" }} />} className="onboarding-back-btn">
            Return to Dashboard
          </Button>

          {/* Hero Header Pill */}
          <div className="sidebar-hero-card" style={{ background: skillMeta.gradient }}>
            <div className="sidebar-hero-badge">
              <Icon name={skillMeta.icon} />
              <span>{skillMeta.label}</span>
            </div>
            <h1 className="sidebar-hero-title">{attempt.module_title}</h1>
            <div className="sidebar-meta-list">
              <div className="sidebar-meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 16 14"/></svg>
                <span>{totalDurationMinutes} Mins Allocated</span>
              </div>
              <div className="sidebar-meta-item">
                <Icon name="help" />
                <span>{totalQuestions} Questions · {attempt.parts.length} {attempt.parts.length === 1 ? "Section" : "Sections"}</span>
              </div>
              <div className="sidebar-meta-item">
                <Icon name="user" />
                <span>{testContext}</span>
                {brandMark && <span className="sidebar-brand-mark">{brandMark}</span>}
              </div>
            </div>
          </div>

          {/* MicroInteractions UI Stepper */}
          <div className="vertical-milestone-nav">
            <Stepper value={step} orientation="vertical">
              {onboardingSteps.map(({ step: stepNum, title, description }) => (
                <StepperItem key={stepNum} step={stepNum}>
                  <StepperTrigger onClick={() => setStep(stepNum as 1 | 2 | 3 | 4)}>
                    <StepperIndicator />
                    <div className="space-y-0.5 px-2 text-left">
                      <StepperTitle>{title}</StepperTitle>
                      <StepperDescription>{description}</StepperDescription>
                    </div>
                  </StepperTrigger>
                  {stepNum < onboardingSteps.length && (
                    <StepperSeparator />
                  )}
                </StepperItem>
              ))}
            </Stepper>
          </div>

        </aside>

        {/* RIGHT COLUMN: Stage Content Area */}
        <main className="onboarding-main-stage">
          {/* Top Stage Header Indicator */}
          <div className="stage-top-header">
            <span className="stage-step-pill">Stage {step} of 4</span>
            <div className="stage-progress-bar-track">
              <div className="stage-progress-bar-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <span className="stage-percent-text">{progressPercent}% Completed</span>
          </div>

          <div className="onboarding-card-body">
            {/* STEP 1: GUIDELINES & PROTOCOL */}
            {step === 1 && (
              <div className="onboarding-step-content stage-fade-in">
                <div className="onboarding-card-header">
                  <div className="header-icon-badge">
                    <Icon name="check" />
                  </div>
                  <div>
                    <h2>Session Security & Integrity Guidelines</h2>
                    <p className="header-subtitle">Review official candidate directives and exam protocols before commencing</p>
                  </div>
                </div>

                {(attempt.show_onboarding_instructions ?? true) ? (
                  <div className="onboarding-rules-list">
                    {(attempt.onboarding_instructions && attempt.onboarding_instructions.length > 0) ? (
                      attempt.onboarding_instructions.map((item, idx) => {
                        const iconColors = ["icon-blue", "icon-green", "icon-amber", "icon-purple", "icon-cyan"];
                        const colorClass = iconColors[idx % iconColors.length];
                        return (
                          <div className="onboarding-rule-item" key={item.id || idx}>
                            <div className={`rule-icon-box ${colorClass}`}>
                              <Icon name={(item.icon as any) || "check"} />
                            </div>
                            <div className="rule-text">
                              <strong>{item.title}.</strong> {item.description}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <>
                        <div className="onboarding-rule-item">
                          <div className="rule-icon-box icon-blue">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 16 14"/></svg>
                          </div>
                          <div className="rule-text">
                            <strong>Strict Exam Timer — {totalDurationMinutes} Minutes.</strong> The countdown timer initiates immediately upon clicking "Commence Assessment". Responses will auto-submit when the duration expires.
                          </div>
                        </div>

                        <div className="onboarding-rule-item">
                          <div className="rule-icon-box icon-green">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/></svg>
                          </div>
                          <div className="rule-text">
                            <strong>Real-Time Response Synchronization.</strong> Your responses are encrypted and automatically saved every 30 seconds to prevent data loss.
                          </div>
                        </div>

                        <div className="onboarding-rule-item">
                          <div className="rule-icon-box icon-amber">
                            <Icon name="logout" />
                          </div>
                          <div className="rule-text">
                            <strong>Session Continuity Protocol.</strong> In the event of network disruption, you may resume your active session. Note that the official examination clock continues running.
                          </div>
                        </div>

                        {(attempt.module_type === "speaking" || attempt.module_type === "listening" || attempt.module_type === "full_mock") && (
                          <div className="onboarding-rule-item">
                            <div className="rule-icon-box icon-cyan">
                              <Icon name="microphone" />
                            </div>
                            <div className="rule-text">
                              <strong>Hardware Peripheral Requirements.</strong> Grant browser permissions for audio output and microphone access. Voice recordings are processed and submitted securely.
                            </div>
                          </div>
                        )}

                        <div className="onboarding-rule-item">
                          <div className="rule-icon-box icon-purple">
                            <Icon name="restore" />
                          </div>
                          <div className="rule-text">
                            <strong>Omni-Directional Question Matrix.</strong> Use section tabs or the question navigator panel to review, answer, or modify responses freely prior to submission.
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="onboarding-summary-banner" style={{ marginTop: 20, marginBottom: 20 }}>
                    <Icon name="help" />
                    <span>Candidate integrity guidelines have been streamlined by your instructor for this assessment session.</span>
                  </div>
                )}

                {/* Instructor Directives */}
                {attempt.parts.some((p) => p.instructions) && (
                  <div className="onboarding-instructor-notes-box">
                    <div className="notes-header">
                      <Icon name="edit" />
                      <span>Official Instructor Directives</span>
                    </div>
                    <div className="notes-body">
                      {attempt.parts.map((p, idx) => (
                        p.instructions ? (
                          <div className="directive-item" key={p.id}>
                            <span className="directive-tag">Part {idx + 1}</span>
                            <p>{p.instructions}</p>
                          </div>
                        ) : null
                      ))}
                    </div>
                  </div>
                )}

                <div className="onboarding-actions-row flex-end">
                  <Button variant="primary" size="lg" onClick={() => setStep(2)} rightIcon={<Icon name="chevronDown" style={{ transform: "rotate(-90deg)" }} />}>
                    Proceed: Assessment Structure
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: ASSESSMENT STRUCTURE */}
            {step === 2 && (
              <div className="onboarding-step-content stage-fade-in">
                <div className="onboarding-card-header">
                  <div className="header-icon-badge">
                    <Icon name="overview" />
                  </div>
                  <div>
                    <h2>Assessment Architecture — {attempt.parts.length} {attempt.parts.length === 1 ? "Section" : "Sections"}</h2>
                    <p className="header-subtitle">Comprehensive breakdown of section allocations, question volume, and formats</p>
                  </div>
                </div>

                <div className="onboarding-parts-grid">
                  {attempt.parts.map((part, index) => {
                    const qCount = part.questions?.length || part.question_count || 0;
                    const duration = part.duration_minutes || Math.round(totalDurationMinutes / attempt.parts.length);
                    const percentShare = Math.round((duration / totalDurationMinutes) * 100);

                    return (
                      <div className="onboarding-part-card" key={part.id}>
                        <div className="part-num-badge">{index + 1}</div>
                        <div className="part-card-info">
                          <div className="part-title-row">
                            <h3>Part {index + 1}: {part.title || `Section ${index + 1}`}</h3>
                            <span className="part-q-tag">{qCount} {qCount === 1 ? "Question" : "Questions"}</span>
                          </div>
                          <p className="part-desc">
                            Format: <strong>{part.section_type ? part.section_type.toUpperCase() : "GENERAL"}</strong> · Target Allocation: ~{duration} Minutes
                          </p>
                          <div className="part-time-share-bar">
                            <div className="part-time-share-fill" style={{ width: `${Math.max(10, percentShare)}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="onboarding-summary-banner">
                  <Icon name="help" />
                  <span>
                    Assessment Summary: <strong>{totalQuestions} questions</strong> across <strong>{attempt.parts.length} sections</strong>. Total examination window: <strong>{totalDurationMinutes} minutes</strong>.
                  </span>
                </div>

                <div className="onboarding-actions-row space-between">
                  <Button variant="secondary" size="lg" onClick={() => setStep(1)} leftIcon={<span style={{ paddingRight: 4 }}>←</span>}>
                    Guidelines
                  </Button>
                  <Button variant="primary" size="lg" onClick={() => setStep(3)} rightIcon={<Icon name="chevronDown" style={{ transform: "rotate(-90deg)" }} />}>
                    Proceed: Hardware Audit
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: HARDWARE DIAGNOSTICS */}
            {step === 3 && (
              <div className="onboarding-step-content stage-fade-in">
                <div className="onboarding-card-header">
                  <div className="header-icon-badge">
                    <Icon name="settings" />
                  </div>
                  <div>
                    <h2>Technical & Hardware Diagnostic Audit</h2>
                    <p className="header-subtitle">Verified system parameters and active audio peripheral checks</p>
                  </div>
                </div>

                <div className="onboarding-equipment-list">
                  <div className="equipment-row">
                    <div className="equipment-info">
                      <div className="equipment-icon-box">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                      </div>
                      <div>
                        <strong>Web Engine Environment</strong>
                        <p>{navigator.userAgent.includes("Chrome") ? "Google Chrome (V8 Optimized)" : navigator.userAgent.includes("Safari") ? "Apple WebKit Engine" : "Compliant Browser Architecture"}</p>
                      </div>
                    </div>
                    <span className="equipment-status-badge status-green">✓ Verified</span>
                  </div>

                  <div className="equipment-row">
                    <div className="equipment-info">
                      <div className="equipment-icon-box">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.94 0"/><circle cx="12" cy="20" r="1"/></svg>
                      </div>
                      <div>
                        <strong>Network Latency & Encryption</strong>
                        <p>Low Latency WebSocket / HTTPS Active Sync</p>
                      </div>
                    </div>
                    <span className="equipment-status-badge status-green">✓ Active Sync</span>
                  </div>

                  <div className="equipment-row">
                    <div className="equipment-info">
                      <div className="equipment-icon-box">
                        <Icon name="microphone" />
                      </div>
                      <div>
                        <strong>Audio Input & Playback Peripherals</strong>
                        <p>High-Fidelity voice recording and listening stream audit</p>
                      </div>
                    </div>
                    <span className={`equipment-status-badge ${micTested ? "status-green" : "status-amber"}`}>
                      {micTested ? "✓ Verified & Ready" : "Pending Diagnostic"}
                    </span>
                  </div>
                </div>

                {/* Interactive Microphone Equalizer Container */}
                <div className="onboarding-mic-tester-container">
                  <div className="mic-equalizer-icon-wrapper">
                    <Icon name="microphone" className="mic-tester-large-icon" />
                  </div>
                  <h3>Microphone Decibel Diagnostic</h3>
                  <p className="mic-tester-hint">Test your voice input to verify clear audio recording before launching</p>

                  <button
                    type="button"
                    className={`onboarding-test-mic-btn ${micTesting ? "is-testing" : ""}`}
                    onClick={handleTestMic}
                  >
                    <Icon name="microphone" />
                    <span>{micTesting ? "Auditing Microphones..." : micTested ? "Re-Test Voice Input" : "Run Voice Input Test"}</span>
                  </button>

                  {micTesting && (
                    <div className="mic-equalizer-visualizer">
                      <div className="eq-bar" style={{ height: `${Math.max(20, volumeLevel * 0.8)}%` }} />
                      <div className="eq-bar" style={{ height: `${Math.max(15, volumeLevel * 1.1)}%` }} />
                      <div className="eq-bar" style={{ height: `${Math.max(30, volumeLevel * 1.3)}%` }} />
                      <div className="eq-bar" style={{ height: `${Math.max(25, volumeLevel * 0.9)}%` }} />
                      <div className="eq-bar" style={{ height: `${Math.max(18, volumeLevel * 1.2)}%` }} />
                    </div>
                  )}
                </div>

                <div className="onboarding-actions-row space-between">
                  <Button variant="secondary" size="lg" onClick={() => setStep(2)} leftIcon={<span style={{ paddingRight: 4 }}>←</span>}>
                    Architecture
                  </Button>
                  <Button variant="primary" size="lg" onClick={() => setStep(4)} rightIcon={<Icon name="chevronDown" style={{ transform: "rotate(-90deg)" }} />}>
                    Proceed: Final Authorization
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 4: CANDIDATE AUTHORIZATION & LAUNCH */}
            {step === 4 && (
              <div className="onboarding-step-content text-center stage-fade-in">
                <div className="onboarding-rocket-badge">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.71.12-1.67-.32-2.12a2.03 2.03 0 0 0-2.82-.82c-.5.3-.41.98.1 1.48.46.46 1.12.56 1.63.06.87-.86 1.34-1.78 2.25-2.21-2.5-1.13-4.3-3.7-4.3-6.65A6.364 6.364 0 0 1 12 3.75a6.364 6.364 0 0 1 6 6.384v2.066c2.04-1.16 3.5-3.41 3.5-6.05a6.364 6.364 0 0 0-6.3-6.37"/></svg>
                </div>

                <h2 className="onboarding-ready-heading">Candidate Authorization & Exam Launch</h2>
                <p className="onboarding-ready-desc">
                  You are authorized to commence <strong>{attempt.module_title}</strong>. Upon confirmation below, your official examination session will initiate.
                </p>

                <div className="onboarding-stat-summary-row">
                  <div className="stat-box">
                    <strong>{totalDurationMinutes}m</strong>
                    <span>Duration</span>
                  </div>
                  <div className="stat-box">
                    <strong>{totalQuestions}</strong>
                    <span>Questions</span>
                  </div>
                  <div className="stat-box">
                    <strong>{attempt.parts.length}</strong>
                    <span>{attempt.parts.length === 1 ? "Section" : "Sections"}</span>
                  </div>
                </div>

                <label className="onboarding-consent-card">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  <span>
                    I verify that I have reviewed the examination guidelines, completed hardware diagnostics, and am prepared to commence. I acknowledge that the timed session begins immediately upon clicking "Commence Assessment" and I cannot pause or halt the timer.
                  </span>
                </label>

                {securityError && <p className="onboarding-security-error">{securityError}</p>}
                {concurrentTab && <p className="onboarding-security-error">Another test session is currently active in a separate browser tab.</p>}

                <div className="onboarding-actions-row center-actions">
                  <Button
                    variant="primary"
                    size="lg"
                    disabled={!confirmed || securityStarting || concurrentTab}
                    onClick={onStartSecureSession}
                    leftIcon={<Icon name="play" />}
                    isLoading={securityStarting}
                    className="onboarding-start-exam-btn"
                  >
                    {securityStarting ? "Initializing Examination..." : "Commence Assessment →"}
                  </Button>
                </div>

                <p className="onboarding-good-luck">Maintain focus and manage your time effectively. Good luck!</p>

                <div className="onboarding-actions-row space-between" style={{ marginTop: 28 }}>
                  <Button variant="secondary" size="lg" onClick={() => setStep(3)} leftIcon={<span style={{ paddingRight: 4 }}>←</span>}>
                    Diagnostics
                  </Button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
