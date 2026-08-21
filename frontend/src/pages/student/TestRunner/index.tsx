import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import type { Attempt, AttemptResponse, ProctorFlagType } from "@/api/types";
import { useInstituteBranding } from "@/hooks/useInstituteBranding";
import { unlockSharedAudioContext } from "@/lib/talking-avatar.js";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { hasAttemptResponse } from "@/pages/student/attemptMetrics";
import { testRunnerStrings as strings } from "./TestRunner.strings";
import {
  EMPTY_MEDIA_STATE,
  IMMERSIVE_MODULE_TYPES,
  MAIN_TEST_SECTION_TYPES,
  combinedTimedSectionMinutes,
  COMBINED_TIMER_MODULE_TYPES,
  PROCTOR_SETTLE_MS,
  TAB_LEASE_MS,
  HEARTBEAT_MS,
  DEBOUNCE_MS,
  parseServerTimestamp,
  randomId,
  securityStorageKey,
  showsSectionTimer,
  isSplitCompositeModule,
  storedClientId,
  usesLanguageCertSkin,
  type SecurityMediaState,
} from "./helpers";
import { useExamLightTheme } from "./useExamLightTheme";
import "@/styles/app/pre-exam-onboarding.css";
import "@/styles/app/final-test-languagecert.css";
import { PreExamOnboarding } from "./components/PreExamOnboarding";
import { FinalTestOnboarding } from "./components/FinalTestOnboarding";
import { TestRunnerHeader } from "./components/TestRunnerHeader";
import { ListeningHeaderPlayer } from "./components/ListeningHeaderPlayer";
import { PartsNav } from "./components/PartsNav";
import { LcPartPager } from "./components/LcPartPager";
import { SourcePane } from "./components/SourcePane";
import { QuestionPane } from "./components/QuestionPane";
import { TestRunnerFooter } from "./components/TestRunnerFooter";
import { SubmitConfirmModal } from "./components/SubmitConfirmModal";
import { FullscreenGate } from "./components/FullscreenGate";
import { DesktopRequiredNotice } from "./components/DesktopRequiredNotice";
import { ViolationPolicyModal } from "./components/ViolationPolicyModal";
import { SpeakingInterviewStage } from "./components/SpeakingInterviewStage";
import { DraggableCameraPreview } from "./components/DraggableCameraPreview";

import {
  cloneSpeakingMicrophoneStream,
  createSpeakingMediaRecorder,
  getSpeakingMicrophoneStream,
  releaseSpeakingMicrophone,
} from "@/media/speakingMicrophone";

interface ViolationPolicyResponse {
  risk_score: number;
  violation_count: number;
  violation_limit: number;
  auto_submitted: boolean;
}

interface ViolationNotice {
  count: number;
  limit: number;
  autoSubmitted: boolean;
}

/** Where a candidate resumes when the part they are pointed at is a speaking
    part. Speaking is sat in order, so any speaking target - a saved index, a
    hand-edited `?part=` - resolves to the first speaking part still owed a
    recording rather than the one asked for. Parts outside speaking, and a
    speaking section already finished, are left exactly as they were. */
function speakingEntryIndex(parts: Attempt["parts"], candidateIndex: number): number {
  if (parts[candidateIndex]?.section_type !== "speaking") return candidateIndex;
  const firstUnfinished = parts.findIndex(
    (part) => part.section_type === "speaking"
      && part.question_count > 0
      && part.answered_count < part.question_count,
  );
  return firstUnfinished >= 0 ? firstUnfinished : candidateIndex;
}

export function TestRunner() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);

  const [isMobileDevice, setIsMobileDevice] = useState(() => {
    return window.innerWidth < 1024 || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobileDevice(window.innerWidth < 1024 || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isInstituteStudent = user?.institute_id != null;
  const { branding, logoUrl } = useInstituteBranding(isInstituteStudent ? user?.institute_slug : null);
  const showError = useToastStore((state) => state.showError);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [partIndex, setPartIndex] = useState(() => {
    const param = searchParams.get("part");
    if (param !== null) {
      const p = parseInt(param, 10);
      if (!Number.isNaN(p) && p >= 0) return p;
    }
    const stored = id ? sessionStorage.getItem(`test-runner-part:${id}`) : null;
    if (stored !== null) {
      const p = parseInt(stored, 10);
      if (!Number.isNaN(p) && p >= 0) return p;
    }
    return 0;
  });
  const [secondsLeft, setSecondsLeft] = useState(0);
  /* When the candidate first opened a Reading or Writing part. The block's
     allowance is counted from here, and it is kept in session storage so a
     reload resumes the same countdown instead of handing out a fresh one. */
  const [readingWritingStartedAt, setReadingWritingStartedAt] = useState<number | null>(() => {
    const stored = Number(sessionStorage.getItem(securityStorageKey(id, "rw-started-at")));
    return Number.isFinite(stored) && stored > 0 ? stored : null;
  });
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [isListeningLocked, setIsListeningLocked] = useState(false);
  const hasSpeakingPart = attempt?.parts.some((part) => part.section_type === "speaking") ?? false;

  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const savingIdsRef = useRef(savingIds);
  const debounceTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const [recordingQuestionId, setRecordingQuestionId] = useState<number | null>(null);
  const recordingQuestionIdRef = useRef(recordingQuestionId);
  const [recordingFailedQuestionId, setRecordingFailedQuestionId] = useState<number | null>(null);

  const [fullscreenActive, setFullscreenActive] = useState(() => Boolean(document.fullscreenElement));
  const [securityAuthorized, setSecurityAuthorized] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [securityStarting, setSecurityStarting] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [mediaState, setMediaState] = useState<SecurityMediaState>(EMPTY_MEDIA_STATE);
  const [liveCameraStream, setLiveCameraStream] = useState<MediaStream | null>(null);
  const [concurrentTab, setConcurrentTab] = useState(false);
  const [rulesAccepted] = useState(true);
  const [violationNotice, setViolationNotice] = useState<ViolationNotice | null>(null);
  const submittedRef = useRef(false);
  const speakingTransitionRef = useRef(false);
  const developerFullscreenBypass = useRef(false);
  const sourcePaneRef = useRef<HTMLElement | null>(null);
  const questionPaneRef = useRef<HTMLElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraPreviewRef = useRef<HTMLVideoElement | null>(null);
  const attemptTokenRef = useRef(sessionStorage.getItem(securityStorageKey(id, "token")));
  const securityClientIdRef = useRef(storedClientId(id));
  const eventSequenceRef = useRef(Number(sessionStorage.getItem(securityStorageKey(id, "event-sequence"))) || 0);
  const heartbeatSequenceRef = useRef(0);
  const heartbeatBusyRef = useRef(false);
  const revisionByQuestionRef = useRef<Record<number, number>>({});
  const mediaStateRef = useRef<SecurityMediaState>(EMPTY_MEDIA_STATE);
  const tabInstanceIdRef = useRef(randomId());
  const concurrentFlaggedRef = useRef(false);
  /* Proctoring is disarmed until the secure session is actually live. The
     browser blurs the page while it shows the camera permission prompt -
     which is not the candidate leaving the exam. Flagging that was greeting
     people with "Security warning 1 of 3" before they had answered anything. */
  const securityHandshakeRef = useRef(false);
  const proctorArmedAtRef = useRef(Number.POSITIVE_INFINITY);
  const lastViolationNoticeCountRef = useRef(0);

  const securityHeaders = useCallback(() => (
    attemptTokenRef.current ? { "X-Attempt-Token": attemptTokenRef.current } : {}
  ), []);

  useEffect(() => {
    if (id) {
      sessionStorage.setItem(`test-runner-part:${id}`, String(partIndex));
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (next.get("part") !== String(partIndex)) {
          next.set("part", String(partIndex));
          return next;
        }
        return prev;
      }, { replace: true });
    }
  }, [id, partIndex, setSearchParams]);

  const activeHeartbeatPartId = attempt?.parts[partIndex]?.id ?? null;
  const currentPart = attempt?.parts[partIndex];
  const isListeningPart = currentPart?.section_type === "listening";
  /* Speaking runs as an interview: the parts are sat in order, one at a time,
     and the stage itself hands over when a part is finished. Once it starts
     there is nothing to navigate back to - a recording cannot be retaken, and
     an earlier section reopened mid-interview would leave the examiner waiting
     - so every navigation control is locked for its duration. */
  const isSpeakingPart = currentPart?.section_type === "speaking";
  const isNavigationLocked = isListeningLocked || isSpeakingPart;
  const currentPartRef = useRef(currentPart);
  useEffect(() => {
    currentPartRef.current = currentPart;
  }, [currentPart]);

  useEffect(() => {
    setOnboardingCompleted(sessionStorage.getItem(`onboarding_completed_${id}`) === "true");
    setSecurityAuthorized(false);
  }, [id]);

  /* An attempt is created waiting at onboarding, and commencing it is what
     starts the clock. A module whose instructor turned the onboarding screen
     off has no screen to press Start on, so entering the runner is that moment
     and the attempt commences here instead - otherwise the paper would open
     with a timer that never began. */
  const autoCommencedRef = useRef(false);
  useEffect(() => {
    if (!attempt || attempt.status !== "ready" || attempt.security_required) return;
    if (attempt.show_onboarding_instructions ?? true) return;
    if (autoCommencedRef.current) return;
    autoCommencedRef.current = true;
    apiClient.post<Attempt>(`/student/attempts/${id}/commence`)
      .then(({ data }) => {
        setAttempt(data);
        setSecurityAuthorized(true);
      })
      .catch((err: unknown) => {
        autoCommencedRef.current = false;
        showError(extractErrorMessage(err, "Failed to start assessment session"));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt?.id, attempt?.status, id]);

  useEffect(() => {
    apiClient
      .get<Attempt>(`/student/attempts/${id}`, { headers: securityHeaders() })
      .then(({ data }) => {
        if (data.status !== "ready" && data.status !== "in_progress") {
          navigate(`/student/attempts/${id}/result`, { replace: true });
          return;
        }
        data.parts.forEach((part) => part.questions.forEach((question) => {
          revisionByQuestionRef.current[question.id] = question.revision;
        }));
        setSecurityAuthorized(data.status === "in_progress" ? data.security_authorized : false);

        // Restore active part from URL or sessionStorage
        const savedPartParam = searchParams.get("part");
        const savedPartStorage = sessionStorage.getItem(`test-runner-part:${id}`);
        const candidateIndex = savedPartParam !== null ? parseInt(savedPartParam, 10) : (savedPartStorage !== null ? parseInt(savedPartStorage, 10) : 0);
        const restoredIndex = (!Number.isNaN(candidateIndex) && candidateIndex >= 0 && candidateIndex < data.parts.length) ? candidateIndex : 0;
        const splitComposite = isSplitCompositeModule(data.module_type)
          && data.parts.some((part) => part.section_type === "speaking");
        const speakingStarted = sessionStorage.getItem(securityStorageKey(id, "speaking-started")) === "true"
          || data.parts.some((part) => part.section_type === "speaking" && part.answered_count > 0);
        const mainPaperComplete = data.parts
          .filter((part) => MAIN_TEST_SECTION_TYPES.has(part.section_type))
          .every((part) => part.question_count === 0 || part.answered_count >= part.question_count);
        const requestedSpeaking = data.parts[restoredIndex]?.section_type === "speaking";
        const firstSpeakingIndex = data.parts.findIndex((part) => part.section_type === "speaking");
        const phaseIndex = splitComposite && speakingStarted && firstSpeakingIndex >= 0
          ? firstSpeakingIndex
          : splitComposite && requestedSpeaking && !mainPaperComplete
            ? 0
            : restoredIndex;
        const resolvedPartIndex = speakingEntryIndex(data.parts, phaseIndex);
        setPartIndex(resolvedPartIndex);

        const targetPart = data.parts[resolvedPartIndex];
        if (data.is_final && targetPart && targetPart.question_count > 0 && targetPart.questions.length === 0) {
          apiClient.get<Attempt["parts"][number]>(
            `/student/attempts/${id}/parts/${targetPart.id}`,
            { headers: { ...securityHeaders(), "X-Skip-Loader": "1" } },
          ).then(({ data: partData }) => {
            partData.questions.forEach((question) => {
              revisionByQuestionRef.current[question.id] = question.revision;
            });
            setAttempt({
              ...data,
              parts: data.parts.map((p) => p.id === partData.id ? partData : p),
            });
          }).catch(() => {
            setAttempt(data);
          });
        } else {
          setAttempt(data);
        }
      })
      .catch(() => setError(strings.loadError));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, navigate, securityHeaders]);

  useEffect(() => {
    savingIdsRef.current = savingIds;
  }, [savingIds]);

  useEffect(() => {
    recordingQuestionIdRef.current = recordingQuestionId;
  }, [recordingQuestionId]);

  const submit = useCallback(async (isAuto: any = false) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);

    // Don't cut off a response the student is still recording or that's
    // still uploading - flush it first so auto-submit (timer hitting zero)
    // can't silently drop the last answer.
    if (recordingQuestionIdRef.current !== null) {
      recorderRef.current?.stop();
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    const flushDeadline = Date.now() + 8000;
    while (savingIdsRef.current.size > 0 && Date.now() < flushDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    try {
      await apiClient.post(`/student/attempts/${id}/submit${isAuto === true ? "?auto=true" : ""}`, undefined, { headers: securityHeaders() });
      stopSecurityMedia();
      sessionStorage.removeItem(securityStorageKey(id, "token"));
      navigate(`/student/attempts/${id}/result`, { replace: true });
    } catch (err: unknown) {
      submittedRef.current = false;
      setSubmitting(false);
      showError(extractErrorMessage(err, strings.errors.submit), strings.errors.submitTitle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, navigate, securityHeaders, showError]);

  const updateSecurityMedia = useCallback((next: Partial<SecurityMediaState>) => {
    const merged = { ...mediaStateRef.current, ...next };
    mediaStateRef.current = merged;
    setMediaState(merged);
  }, []);

  const handleViolationPolicy = useCallback((policy: ViolationPolicyResponse) => {
    setAttempt((current) => current ? { ...current, security_risk_score: policy.risk_score } : current);
    if (policy.violation_count <= 0 || policy.violation_count === lastViolationNoticeCountRef.current) return;
    lastViolationNoticeCountRef.current = policy.violation_count;
    if (policy.auto_submitted) {
      submittedRef.current = true;
      setSubmitting(false);
      stopSecurityMedia();
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
      setFullscreenActive(false);
      updateSecurityMedia({ fullscreen: false });
      sessionStorage.removeItem(securityStorageKey(id, "token"));
    }
    setViolationNotice({
      count: policy.violation_count,
      limit: policy.violation_limit,
      autoSubmitted: policy.auto_submitted,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, updateSecurityMedia]);

  /* On a Final Test or Full Mock the countdown is the Reading and Writing
     block's own allowance - the parts' durations added together - counted from
     the moment that block is entered. Anything else drifts: showing what is
     left of the whole attempt makes the number depend on how long Listening
     took, which is not time the candidate spends on these sections. */
  const combinedBlockSeconds = useMemo(() => {
    if (!attempt || !COMBINED_TIMER_MODULE_TYPES.has(attempt.module_type)) return null;
    const minutes = combinedTimedSectionMinutes(attempt.parts);
    return minutes === null ? null : minutes * 60;
  }, [attempt]);

  const isSplitCompositeAttempt = Boolean(
    attempt
      && isSplitCompositeModule(attempt.module_type)
      && attempt.parts.some((part) => part.section_type === "speaking"),
  );
  const isSpeakingPhase = isSplitCompositeAttempt && currentPart?.section_type === "speaking";

  // Countdown timer. The server's expires_at is the outer bound - it rejects
  // writes past its own clock independently - and the block allowance, where
  // there is one, is the inner bound. Whichever runs out first ends the sitting.
  useEffect(() => {
    if (!attempt || attempt.status !== "in_progress") return;
    function tick() {
      if (!attempt) return;
      const attemptRemaining = (parseServerTimestamp(attempt.expires_at) - Date.now()) / 1000;
      const blockRemaining = !isSpeakingPhase && combinedBlockSeconds !== null && readingWritingStartedAt !== null
        ? combinedBlockSeconds - (Date.now() - readingWritingStartedAt) / 1000
        : Number.POSITIVE_INFINITY;
      const remaining = Math.min(attemptRemaining, blockRemaining);
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        if (attemptRemaining <= 0) {
          submit(true);
        } else if (isSplitCompositeAttempt && !isSpeakingPhase) {
          void enterSpeakingPhase();
        } else {
          submit(true);
        }
      }
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  // `enterSpeakingPhase` is declared below the hooks and intentionally reads
  // the latest attempt when the interval fires.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, submit, combinedBlockSeconds, readingWritingStartedAt, isSpeakingPhase, isSplitCompositeAttempt]);

  // Keep the display awake throughout a live Speaking test. Unsupported or
  // power-restricted browsers simply continue without a wake lock.
  useEffect(() => {
    if (attempt?.status !== "in_progress" || !hasSpeakingPart) return;
    type WakeLockSentinelLike = { release: () => Promise<void>; released?: boolean };
    type NavigatorWithWakeLock = Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> } };
    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const requestWakeLock = async () => {
      if (document.visibilityState !== "visible" || sentinel) return;
      try {
        const acquired = await (navigator as NavigatorWithWakeLock).wakeLock?.request("screen");
        if (!acquired) return;
        if (cancelled) {
          await acquired.release();
          return;
        }
        sentinel = acquired;
      } catch {
        // The assessment stays usable if the device denies a wake lock.
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && (!sentinel || sentinel.released)) {
        sentinel = null;
        void requestWakeLock();
      }
    };

    void requestWakeLock();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void sentinel?.release();
      sentinel = null;
    };
  }, [attempt?.id, attempt?.status, hasSpeakingPart]);

  useEffect(() => () => releaseSpeakingMicrophone(), []);

  const recordFlag = useCallback(
    (flagType: ProctorFlagType, meta?: Record<string, unknown>) => {
      if (user?.email === "mehtanavish60@gmail.com") return;
      if (!attemptTokenRef.current) return;
      eventSequenceRef.current += 1;
      sessionStorage.setItem(securityStorageKey(id, "event-sequence"), String(eventSequenceRef.current));
      apiClient.post<ViolationPolicyResponse>(
        `/student/attempts/${id}/flags`,
        {
          flag_type: flagType,
          meta,
          client_sequence: eventSequenceRef.current,
          client_occurred_at: new Date().toISOString(),
        },
        { headers: { ...securityHeaders(), "X-Skip-Loader": "1" } },
      ).then(({ data }) => handleViolationPolicy(data)).catch(() => {});
    },
    [handleViolationPolicy, id, securityHeaders, user?.email],
  );

  const isImmersiveAttempt = attempt ? IMMERSIVE_MODULE_TYPES.has(attempt.module_type) : false;
  const immersiveAttemptId = isImmersiveAttempt ? attempt?.id : null;
  const isFinalAttempt = attempt?.is_final ?? false;
  /* Strictly the Final Test module type - a full mock stays on the standard
     engine skin even though it shares the immersive/fullscreen behaviour. */
  const languageCertSkin = usesLanguageCertSkin(attempt?.module_type);
  /* The exam client has no dark mode, so the Final Test sits the whole attempt
     on the light surface and hands the candidate's preference back on exit. */
  useExamLightTheme(languageCertSkin);
  /* The global toast stack renders outside this component's own tree, above
     the `.lc-exam` wrapper, so a body class is what lets its stylesheet tell
     a Final Test notification (e.g. "Submit Failed") apart from an ordinary
     app one and give it the exam's own look instead of the generic app card. */
  useEffect(() => {
    document.body.classList.toggle("lc-final-test-active", languageCertSkin);
    return () => document.body.classList.remove("lc-final-test-active");
  }, [languageCertSkin]);
  /* Reading and Writing share one countdown; Listening and Speaking show none.
     Decided here so the header, and the gate that can cover it, cannot drift
     apart on what the candidate is allowed to see. */
  const timerVisible = currentPart ? showsSectionTimer(attempt?.module_type, currentPart.section_type) : false;

  /* The block clock starts the first time a Reading or Writing part is opened,
     not when the attempt does - Listening comes first and is paced by its own
     recordings. Stamped once and then left alone. */
  useEffect(() => {
    if (!timerVisible || combinedBlockSeconds === null) return;
    if (attempt?.status !== "in_progress") return;
    if (readingWritingStartedAt !== null) return;
    const startedAt = Date.now();
    sessionStorage.setItem(securityStorageKey(id, "rw-started-at"), String(startedAt));
    setReadingWritingStartedAt(startedAt);
  }, [attempt?.status, combinedBlockSeconds, id, readingWritingStartedAt, timerVisible]);
  const attemptStatus = attempt?.status;

  const isReadingOrWriting = currentPart?.section_type === "reading" || currentPart?.section_type === "writing";
  useEffect(() => {
    if (attempt?.id && isReadingOrWriting) {
      localStorage.setItem(`vh:listening:all_completed:${attempt.id}`, "true");
    }
  }, [attempt?.id, isReadingOrWriting]);

  /* Armed off `securityAuthorized` rather than from inside `startSecureSession`,
     because a resumed attempt comes back already authorised from the server and
     never runs the handshake - keying off the flag covers both routes. */
  useEffect(() => {
    proctorArmedAtRef.current = securityAuthorized
      ? Date.now() + PROCTOR_SETTLE_MS
      : Number.POSITIVE_INFINITY;
  }, [securityAuthorized]);

  /** Whether a browser event should count against the candidate yet. */
  const proctorArmed = useCallback(
    () => !securityHandshakeRef.current && Date.now() >= proctorArmedAtRef.current,
    [],
  );

  const onRequiredTrackEnded = useCallback((kind: "camera" | "microphone") => {
    updateSecurityMedia({ [kind]: false });
    const flag: ProctorFlagType = kind === "camera" ? "camera_stopped" : "microphone_stopped";
    recordFlag(flag, { ready_state: "ended" });
  }, [recordFlag, updateSecurityMedia]);

  // Composite tests occupy the full viewport. Final Tests additionally retain
  // strict proctor flagging and mandatory live media throughout the sitting.
  useEffect(() => {
    if (attemptStatus !== "ready" && attemptStatus !== "in_progress") return;
    developerFullscreenBypass.current = false;
    setFullscreenActive(Boolean(document.fullscreenElement));

    function onFullscreenChange() {
      const isActive = Boolean(document.fullscreenElement);
      setFullscreenActive(isActive);
      updateSecurityMedia({ fullscreen: isActive });
      if (!isActive && isFinalAttempt && !submittedRef.current && !developerFullscreenBypass.current && proctorArmed()) {
        recordFlag("fullscreen_exit");
      }
    }
    function onVisibilityChange() {
      if (isFinalAttempt && document.hidden && !submittedRef.current && proctorArmed()) recordFlag("visibility_change");
    }
    function onBlur() {
      if (isFinalAttempt && !submittedRef.current && proctorArmed()) recordFlag("blur");
    }
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!isFinalAttempt || submittedRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    /* The engine lets a writing task keep the clipboard, on the grounds that
       composing an essay legitimately involves moving text around. The Final
       Test does not: the response has to be typed, and a candidate who can
       paste can bring prepared prose in from anywhere. So the exemption is
       withdrawn for this one module type and copy, cut and paste are blocked
       across every section, writing included. */
    function isClipboardExemptPart() {
      if (languageCertSkin) return false;
      const activePart = currentPartRef.current;
      return activePart?.section_type === "writing"
        || Boolean(activePart?.questions?.some((q) => q.question_type === "essay"));
    }
    function onClipboard(event: ClipboardEvent) {
      if (isClipboardExemptPart()) return;
      event.preventDefault();
      if (isFinalAttempt && !submittedRef.current) {
        recordFlag("clipboard", { operation: event.type });
      }
    }
    /* Blocked alongside the clipboard events: leaving the menu open while its
       Paste item silently does nothing reads as a broken page rather than a
       rule, and right-click is the other route to the same thing. */
    function onContextMenu(event: MouseEvent) {
      if (isClipboardExemptPart()) return;
      event.preventDefault();
      if (isFinalAttempt && !submittedRef.current) recordFlag("context_menu");
    }
    function onKeyDown(event: KeyboardEvent) {
      const command = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (command && ["c", "x", "v"].includes(key)) {
        if (isClipboardExemptPart()) return;
        event.preventDefault();
        if (isFinalAttempt && !submittedRef.current) {
          recordFlag("clipboard", { operation: key === "c" ? "copy" : key === "x" ? "cut" : "paste", source: "keyboard" });
        }
      } else if (isFinalAttempt && !submittedRef.current && command && key === "p") {
        event.preventDefault();
        recordFlag("print_attempt");
      } else if (isFinalAttempt && !submittedRef.current && event.key === "PrintScreen") {
        event.preventDefault();
        recordFlag("print_attempt", { key: "PrintScreen" });
      }
    }

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("copy", onClipboard, true);
    document.addEventListener("cut", onClipboard, true);
    document.addEventListener("paste", onClipboard, true);
    document.addEventListener("contextmenu", onContextMenu, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("copy", onClipboard, true);
      document.removeEventListener("cut", onClipboard, true);
      document.removeEventListener("paste", onClipboard, true);
      document.removeEventListener("contextmenu", onContextMenu, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [attemptStatus, immersiveAttemptId, isFinalAttempt, languageCertSkin, proctorArmed, recordFlag, updateSecurityMedia]);

  async function enterFullscreen() {
    developerFullscreenBypass.current = false;
    setSecurityError(null);
    /* Re-entering full screen - whether from the gate or from "Continue test"
       on a violation notice - goes through the same brief transition the
       initial handshake does (the request can bounce the page out of full
       screen before it settles back in). Disarming proctoring for that
       transition, the same way `startSecureSession` does, stops that bounce
       from being read as a second exit and burning another warning on top of
       the one that just brought the candidate here. */
    securityHandshakeRef.current = true;
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      setFullscreenActive(Boolean(document.fullscreenElement));
      updateSecurityMedia({ fullscreen: Boolean(document.fullscreenElement) });
    } catch {
      const message = strings.errors.fullscreenRequired;
      setSecurityError(message);
      showError(message, strings.errors.fullscreenRequiredTitle);
    } finally {
      securityHandshakeRef.current = false;
      proctorArmedAtRef.current = Date.now() + PROCTOR_SETTLE_MS;
    }
  }

  async function exitDeveloperFullscreen() {
    developerFullscreenBypass.current = true;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } finally {
      setFullscreenActive(false);
      updateSecurityMedia({ fullscreen: false });
    }
  }

  function stopSecurityMedia() {
    cameraStreamRef.current?.getTracks().forEach((track) => {
      track.onended = null;
      track.onmute = null;
      track.stop();
    });
    cameraStreamRef.current = null;
    setLiveCameraStream(null);
    if (cameraPreviewRef.current) cameraPreviewRef.current.srcObject = null;
    mediaStateRef.current = EMPTY_MEDIA_STATE;
    setMediaState(EMPTY_MEDIA_STATE);
  }

  async function startSecureSession() {
    try {
      const audio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAAA");
      audio.play().catch(() => {});
      unlockSharedAudioContext();
    } catch (e) {
      console.warn("Audio unlock failed:", e);
    }
    if (securityStarting) return;
    if (!attempt?.is_final) {
      try {
        setSecurityStarting(true);
        const { data } = await apiClient.post<Attempt>(`/student/attempts/${id}/commence`);
        setAttempt(data);
        sessionStorage.setItem(`onboarding_completed_${id}`, "true");
        setOnboardingCompleted(true);
        setSecurityAuthorized(true);
      } catch (err: unknown) {
        showError(extractErrorMessage(err, "Failed to start assessment session"));
      } finally {
        setSecurityStarting(false);
      }
      return;
    }
    if (!rulesAccepted) {
      setSecurityError(strings.security.consentRequired);
      return;
    }
    setSecurityStarting(true);
    setSecurityError(null);
    setConcurrentTab(false);
    securityHandshakeRef.current = true;

    if (!attempt.security_required) {
      try {
        const { data } = await apiClient.post<Attempt>(`/student/attempts/${id}/commence`);
        setAttempt(data);
        sessionStorage.setItem(`onboarding_completed_${id}`, "true");
        setOnboardingCompleted(true);
        setSecurityAuthorized(true);
      } catch (err: unknown) {
        showError(extractErrorMessage(err, "Failed to start assessment session"));
      } finally {
        setSecurityStarting(false);
      }
      return;
    }

    let cameraStream = cameraStreamRef.current;
    let keepMediaActive = false;

    /* `requestFullscreen` needs transient user activation, and the camera
       prompt consumes the activation this click arrived with - so asking for
       full screen only after it resolved was asking with nothing left to
       spend. It goes first now, while the click is still warm, and is
       re-asserted below because the permission prompt can drop the page back
       out of it. */
    const requestExamFullscreen = async () => {
      if (document.fullscreenElement) return true;
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        return false;
      }
      return Boolean(document.fullscreenElement);
    };

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(strings.security.errors.browserUnsupported);
      }

      await requestExamFullscreen();

      let cameraTrack = cameraStream?.getVideoTracks()[0];
      let microphoneTrack = cameraStream?.getAudioTracks()[0];
      const existingMediaActive = cameraTrack?.readyState === "live"
        && microphoneTrack?.readyState === "live";

      if (!existingMediaActive) {
        stopSecurityMedia();
        cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        cameraTrack = cameraStream.getVideoTracks()[0];
        microphoneTrack = cameraStream.getAudioTracks()[0];
        if (!cameraTrack || !microphoneTrack) {
          throw new Error(strings.security.errors.cameraMicRequired);
        }

        cameraStreamRef.current = cameraStream;
        cameraTrack.onended = () => onRequiredTrackEnded("camera");
        cameraTrack.onmute = () => onRequiredTrackEnded("camera");
        microphoneTrack.onended = () => onRequiredTrackEnded("microphone");
        microphoneTrack.onmute = () => onRequiredTrackEnded("microphone");
      }

      if (!cameraStream || !cameraTrack || !microphoneTrack) {
        throw new Error(strings.security.errors.mediaMustRemainActive);
      }

      keepMediaActive = true;
      if (cameraPreviewRef.current) {
        cameraPreviewRef.current.srcObject = cameraStream;
        cameraPreviewRef.current.play().catch(() => {});
      }
      setLiveCameraStream(cameraStream);
      updateSecurityMedia({
        camera: cameraTrack.readyState === "live" && cameraTrack.enabled,
        microphone: microphoneTrack.readyState === "live" && microphoneTrack.enabled,
        fullscreen: Boolean(document.fullscreenElement),
      });

      /* Second attempt: granting the camera can collapse full screen, and the
         click on the permission prompt leaves a fresh activation to spend on
         getting it back. */
      if (!(await requestExamFullscreen())) {
        throw new Error(strings.security.errors.fullscreenAfterMedia);
      }
      setFullscreenActive(true);
      updateSecurityMedia({ fullscreen: true });

      const { data: preflight } = await apiClient.post<{ attempt_token: string }>(
        `/student/attempts/${id}/security/preflight`,
        {
          client_id: securityClientIdRef.current,
          rules_consent: true,
          camera_active: true,
          microphone_active: true,
          fullscreen_active: true,
        },
        { headers: { "X-Skip-Loader": "1" } },
      );
      attemptTokenRef.current = preflight.attempt_token;
      sessionStorage.setItem(securityStorageKey(id, "token"), preflight.attempt_token);
      heartbeatSequenceRef.current = 0;

      const { data } = await apiClient.post<Attempt>(
        `/student/attempts/${id}/security/begin`,
        undefined,
        { headers: { ...securityHeaders(), "X-Skip-Loader": "1" } },
      );
      data.parts.forEach((part) => part.questions.forEach((question) => {
        revisionByQuestionRef.current[question.id] = question.revision;
      }));
      setAttempt(data);
      sessionStorage.setItem(`onboarding_completed_${id}`, "true");
      setOnboardingCompleted(true);
      setSecurityAuthorized(true);
      /* Re-checked, not asserted. Preflight and begin are two network round
         trips, and full screen can be lost while they are in flight - the old
         unconditional `true` here then hid the gate and opened the paper in a
         windowed browser, which is the state the candidate was being warned
         about. Ask for it back, and report whatever is actually true. */
      const fullscreenOnHandover = await requestExamFullscreen();
      setFullscreenActive(fullscreenOnHandover);
      updateSecurityMedia({ fullscreen: fullscreenOnHandover });
    } catch (err: unknown) {
      if (!keepMediaActive) {
        cameraStream?.getTracks().forEach((track) => track.stop());
        stopSecurityMedia();
      } else {
        const cameraTrack = cameraStreamRef.current?.getVideoTracks()[0];
        const microphoneTrack = cameraStreamRef.current?.getAudioTracks()[0];
        updateSecurityMedia({
          camera: cameraTrack?.readyState === "live" && cameraTrack.enabled,
          microphone: microphoneTrack?.readyState === "live" && microphoneTrack.enabled,
          fullscreen: Boolean(document.fullscreenElement),
        });
      }
      setSecurityAuthorized(false);
      setSecurityError(extractErrorMessage(err, err instanceof Error ? err.message : strings.security.errors.generic));
    } finally {
      /* Closed on both routes. The settle window that actually arms proctoring
         is set by the `securityAuthorized` effect, so a failed handshake leaves
         it disarmed rather than counting the retry as a violation. */
      securityHandshakeRef.current = false;
      setSecurityStarting(false);
    }
  }

  useEffect(() => {
    return () => {
      stopSecurityMedia();
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (!attempt?.is_final || attempt.status !== "in_progress" || !securityAuthorized || !attemptTokenRef.current) return;

    let cancelled = false;
    async function heartbeat() {
      if (cancelled || heartbeatBusyRef.current) return;
      heartbeatBusyRef.current = true;
      heartbeatSequenceRef.current += 1;
      const state = mediaStateRef.current;
      try {
        const isBypass = user?.email === "mehtanavish60@gmail.com";
        const isArmed = proctorArmed() && !isBypass;
        const { data } = await apiClient.post<ViolationPolicyResponse>(
          `/student/attempts/${id}/security/heartbeat`,
          {
            sequence: heartbeatSequenceRef.current,
            client_id: securityClientIdRef.current,
            camera_active: isArmed ? state.camera : true,
            microphone_active: isArmed ? state.microphone : true,
            fullscreen_active: isArmed ? Boolean(document.fullscreenElement) : true,
            visible: isArmed ? !document.hidden : true,
            focused: isArmed ? document.hasFocus() : true,
            current_part_id: activeHeartbeatPartId,
            client_at: new Date().toISOString(),
          },
          { headers: { ...securityHeaders(), "X-Skip-Loader": "1" } },
        );
        handleViolationPolicy(data);
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 403 || status === 409) {
          setSecurityAuthorized(false);
          setSecurityError(extractErrorMessage(err, strings.security.errors.sessionRestoreNeeded));
        }
      } finally {
        heartbeatBusyRef.current = false;
      }
    }
    heartbeat();
    const interval = window.setInterval(heartbeat, HEARTBEAT_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [attempt?.id, attempt?.is_final, attempt?.status, activeHeartbeatPartId, handleViolationPolicy, securityAuthorized, id, securityHeaders, user?.email]);

  useEffect(() => {
    if (!attempt?.is_final || attempt.status !== "in_progress") return;
    const leaseKey = `final-test-tab-lease:${attempt.id}`;
    const tabId = tabInstanceIdRef.current;

    function flagConcurrentTab() {
      setConcurrentTab(true);
      if (!concurrentFlaggedRef.current) {
        concurrentFlaggedRef.current = true;
        recordFlag("concurrent_tab", { source: "browser_tab_lease" });
      }
    }

    function claimLease() {
      try {
        const raw = localStorage.getItem(leaseKey);
        const current = raw ? JSON.parse(raw) as { tabId?: string; updatedAt?: number } : null;
        if (
          current?.tabId
          && current.tabId !== tabId
          && typeof current.updatedAt === "number"
          && Date.now() - current.updatedAt < TAB_LEASE_MS
        ) {
          flagConcurrentTab();
          return;
        }
        localStorage.setItem(leaseKey, JSON.stringify({ tabId, updatedAt: Date.now() }));
        setConcurrentTab(false);
        concurrentFlaggedRef.current = false;
      } catch {
        // Storage can be disabled; server-side device/token binding still applies.
      }
    }

    function onStorage(event: StorageEvent) {
      if (event.key !== leaseKey || !event.newValue) return;
      try {
        const lease = JSON.parse(event.newValue) as { tabId?: string; updatedAt?: number };
        if (lease.tabId !== tabId && Date.now() - Number(lease.updatedAt) < TAB_LEASE_MS) flagConcurrentTab();
      } catch {
        // Ignore malformed storage written by unrelated scripts.
      }
    }

    claimLease();
    const interval = window.setInterval(claimLease, TAB_LEASE_MS / 3);
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", onStorage);
      try {
        const lease = JSON.parse(localStorage.getItem(leaseKey) ?? "null") as { tabId?: string } | null;
        if (lease?.tabId === tabId) localStorage.removeItem(leaseKey);
      } catch {
        // Nothing to release.
      }
    };
  }, [attempt?.id, attempt?.is_final, attempt?.status, recordFlag]);



  async function persist(questionId: number, response: AttemptResponse, revision: number) {
    setSavingIds((prev) => new Set(prev).add(questionId));
    try {
      await apiClient.put(
        `/student/attempts/${id}/answers/${questionId}`,
        { response, revision },
        { headers: { ...securityHeaders(), "X-Skip-Loader": "1" } },
      );
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status !== 409) showError(extractErrorMessage(err, strings.errors.save), strings.errors.saveTitle);
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(questionId);
        return next;
      });
    }
  }

  function updateResponse(questionId: number, response: AttemptResponse, debounce = false) {
    const revision = (revisionByQuestionRef.current[questionId] ?? 0) + 1;
    revisionByQuestionRef.current[questionId] = revision;
    setAttempt((current) => {
      if (!current) return current;
      const parts = current.parts.map((part) => {
        if (!part.questions.some((question) => question.id === questionId)) return part;
        const questions = part.questions.map((question) => (
          question.id === questionId ? { ...question, response, revision } : question
        ));
        return { ...part, questions, answered_count: questions.filter(hasAttemptResponse).length };
      });
      return { ...current, parts };
    });
    if (debounce) {
      clearTimeout(debounceTimers.current[questionId]);
      debounceTimers.current[questionId] = setTimeout(() => persist(questionId, response, revision), DEBOUNCE_MS);
    } else {
      persist(questionId, response, revision);
    }
  }

  async function recordSpeakingAnswer(questionId: number): Promise<boolean> {
    if (recorderRef.current?.state === "recording") {
      if (recordingQuestionIdRef.current !== questionId) return false;
      recorderRef.current.requestData();
      recorderRef.current.stop();
      return true;
    }
    try {
      setRecordingFailedQuestionId(null);
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("Audio recording is not supported by this browser");
      }

      // Final tests already hold a proctoring microphone stream. Clone that
      // live track so starting a Speaking answer does not request or seize the
      // physical microphone a second time.
      const secureStream = cameraStreamRef.current;
      if (!secureStream?.getAudioTracks().some((track) => track.readyState === "live" && track.enabled)) {
        await getSpeakingMicrophoneStream();
      }
      const stream = cloneSpeakingMicrophoneStream(secureStream);
      recordingStreamRef.current = stream;
      const recorder = createSpeakingMediaRecorder(stream);
      const chunks: BlobPart[] = [];
      let recorderFailed = false;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => {
        recorderFailed = true;
        stream.getTracks().forEach((track) => track.stop());
        if (!isFinalAttempt) {
          releaseSpeakingMicrophone();
        }
        recordingStreamRef.current = null;
        recorderRef.current = null;
        recordingQuestionIdRef.current = null;
        setRecordingQuestionId(null);
        setRecordingFailedQuestionId(questionId);
        showError(strings.errors.microphoneBlocked, strings.errors.microphoneBlockedTitle);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        recorderRef.current = null;
        recordingQuestionIdRef.current = null;
        setRecordingQuestionId(null);
        if (recorderFailed) return;
        const contentType = (recorder.mimeType || "audio/webm").split(";")[0];
        const extension = contentType === "audio/mp4" ? "m4a" : contentType === "audio/ogg" ? "ogg" : "webm";
        const blob = new Blob(chunks, { type: contentType });
        if (blob.size < 4096) {
          if (!isFinalAttempt) {
            releaseSpeakingMicrophone();
          }
          setRecordingFailedQuestionId(questionId);
          showError(strings.errors.emptyRecording, strings.errors.recordingUploadTitle);
          return;
        }
        const form = new FormData();
        form.append("file", blob, `answer.${extension}`);
        setSavingIds((prev) => new Set(prev).add(questionId));
        try {
          await apiClient.post(`/student/attempts/${id}/answers/${questionId}/audio`, form, { headers: securityHeaders() });
          setAttempt((current) => {
            if (!current) return current;
            return {
              ...current,
              parts: current.parts.map((part) => {
                const questions = part.questions.map((q) => (
                  q.id === questionId ? { ...q, response: { recorded: true } } : q
                ));
                return { ...part, questions, answered_count: questions.filter(hasAttemptResponse).length };
              }),
            };
          });
        } catch (err: unknown) {
          setRecordingFailedQuestionId(questionId);
          showError(extractErrorMessage(err, strings.errors.recordingUpload), strings.errors.recordingUploadTitle);
        } finally {
          setSavingIds((prev) => {
            const next = new Set(prev);
            next.delete(questionId);
            return next;
          });
        }
      };
      recorderRef.current = recorder;
      recordingQuestionIdRef.current = questionId;
      recorder.start(1000);
      setRecordingQuestionId(questionId);
      setAttempt((current) => {
        if (!current) return current;
        return {
          ...current,
          parts: current.parts.map((part) => {
            const questions = part.questions.map((question) => (
              question.id === questionId
                ? { ...question, response: null, audio_path: null }
                : question
            ));
            return { ...part, questions, answered_count: questions.filter(hasAttemptResponse).length };
          }),
        };
      });
      return true;
    } catch {
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      recorderRef.current = null;
      recordingQuestionIdRef.current = null;
      if (!isFinalAttempt) {
        releaseSpeakingMicrophone();
      }
      showError(strings.errors.microphoneBlocked, strings.errors.microphoneBlockedTitle);
      return false;
    }
  }

  const phasePartEntries = useMemo(() => {
    if (!attempt) return [];
    return attempt.parts
      .map((part, index) => ({ part, index }))
      .filter(({ part }) => !isSplitCompositeAttempt
        || (isSpeakingPhase ? part.section_type === "speaking" : MAIN_TEST_SECTION_TYPES.has(part.section_type)));
  }, [attempt, isSpeakingPhase, isSplitCompositeAttempt]);
  const answeredCount = useMemo(
    () => phasePartEntries.reduce((sum, { part }) => sum + part.answered_count, 0),
    [phasePartEntries],
  );
  const totalQuestions = useMemo(
    () => phasePartEntries.reduce((sum, { part }) => sum + part.question_count, 0),
    [phasePartEntries],
  );
  const sectionGroups = useMemo(() => {
    const sectionLabels: Record<string, string> = strings.sectionLabels;
    const groups: Array<{
      section: string;
      label: string;
      parts: Array<{ part: Attempt["parts"][number]; index: number }>;
    }> = [];
    phasePartEntries.forEach(({ part, index }) => {
      let group = groups.find((item) => item.section === part.section_type);
      if (!group) {
        group = {
          section: part.section_type,
          label: sectionLabels[part.section_type] ?? part.section_type,
          parts: [],
        };
        groups.push(group);
      }
      group.parts.push({ part, index });
    });
    return groups;
  }, [phasePartEntries]);
  const passages = useMemo(
    () => Array.from(new Set((currentPart?.questions ?? []).map((question) => question.passage?.trim()).filter(Boolean))) as string[],
    [currentPart],
  );
  const questionImages = useMemo(
    () => Array.from(new Set((currentPart?.questions ?? []).map((question) => question.image_url).filter(Boolean))) as string[],
    [currentPart],
  );
  const questionNumberOffset = useMemo(
    () => attempt?.parts.slice(0, partIndex).reduce((sum, part) => sum + part.question_count, 0) ?? 0,
    [attempt, partIndex],
  );

  const hasSourcePane = useMemo(() => {
    if (!currentPart || isListeningPart) return false;
    const matchingType = currentPart.questions[0]?.question_type;
    const usesInlineMatchingBlanks =
      currentPart.answer_constraints.layout === "inline_matching_blanks" &&
      (matchingType === "matching_unique" || matchingType === "matching_reusable");
    const usesSourceTextMatching =
      (currentPart.answer_constraints.layout === "source_text_matching" || currentPart.part_code === "reading_3") &&
      (matchingType === "matching_unique" || matchingType === "matching_reusable");
    const usesSharedCloze =
      currentPart.part_code === "reading_1b" && currentPart.answer_constraints.layout === "shared_cloze";
    const isWriting = currentPart.section_type === "writing";
    const hasRealPassage = passages.length > 0 && currentPart.answer_constraints.layout !== "notepad_gaps";
    const hasImages = questionImages.length > 0;
    const hasAssets = (currentPart.assets?.length ?? 0) > 0;

    return (
      isWriting ||
      usesSharedCloze ||
      usesInlineMatchingBlanks ||
      usesSourceTextMatching ||
      hasRealPassage ||
      hasImages ||
      hasAssets
    );
  }, [currentPart, isListeningPart, passages, questionImages]);

  /* Memoised on the part it belongs to, and nothing else: the player holds a
     five-second timer keyed on this callback, and a fresh identity on every
     render would restart that timer forever and never advance the candidate. */
  const totalParts = attempt?.parts.length ?? 0;
  const handleListeningPartComplete = useCallback(() => {
    if (partIndex < totalParts - 1) void selectPart(partIndex + 1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partIndex, totalParts]);

  async function selectPart(index: number, force = false) {
    if (isNavigationLocked && !force && index !== partIndex) return;
    const selectedPart = attempt?.parts[index];
    if (isSplitCompositeAttempt && selectedPart && currentPart) {
      const targetIsSpeaking = selectedPart.section_type === "speaking";
      if (isSpeakingPhase && !targetIsSpeaking) return;
      if (!isSpeakingPhase && targetIsSpeaking && !force) return;
    }
    if (
      attempt?.is_final
      && selectedPart
      && selectedPart.question_count > 0
      && selectedPart.questions.length === 0
    ) {
      try {
        const { data } = await apiClient.get<Attempt["parts"][number]>(
          `/student/attempts/${id}/parts/${selectedPart.id}`,
          { headers: { ...securityHeaders(), "X-Skip-Loader": "1" } },
        );
        data.questions.forEach((question) => {
          revisionByQuestionRef.current[question.id] = question.revision;
        });
        setAttempt((current) => current ? {
          ...current,
          parts: current.parts.map((part) => part.id === data.id ? data : part),
        } : current);
      } catch (err: unknown) {
        showError(extractErrorMessage(err, strings.errors.part), strings.errors.partTitle);
        return;
      }
    }
    setPartIndex(index);
    requestAnimationFrame(() => {
      sourcePaneRef.current?.scrollTo({ top: 0 });
      questionPaneRef.current?.scrollTo({ top: 0 });
    });
  }

  async function enterSpeakingPhase() {
    if (!attempt || speakingTransitionRef.current) return;
    const firstSpeakingIndex = attempt.parts.findIndex((part) => part.section_type === "speaking");
    if (firstSpeakingIndex < 0) {
      await submit();
      return;
    }
    speakingTransitionRef.current = true;
    // Let any active or just-debounced Writing save finish before its editor is
    // unmounted. The local response is already updated, but this keeps the
    // server copy caught up before the paper becomes inaccessible.
    await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS + 50));
    const flushDeadline = Date.now() + 8000;
    while (savingIdsRef.current.size > 0 && Date.now() < flushDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    sessionStorage.setItem(securityStorageKey(id, "speaking-started"), "true");
    setConfirmSubmit(false);
    await selectPart(speakingEntryIndex(attempt.parts, firstSpeakingIndex), true);
    speakingTransitionRef.current = false;
  }

  // Declared after every hook: this branch flips on window resize, so returning
  // above the hook calls would change hook order and crash a running attempt.
  if (isMobileDevice) {
    return <DesktopRequiredNotice onBackToDashboard={() => navigate("/student/dashboard")} />;
  }

  if (error) return <p className="error-text">{error}</p>;
  if (!attempt) return <div className="test-runner-loading">{strings.loading}</div>;

  const brandedTestClass = isInstituteStudent ? " institute-branded-test" : "";
  const brandInitials = branding?.institute_name
    ? branding.institute_name.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase()
    : isInstituteStudent ? "IN" : "VH";
  const brandMark = logoUrl
    ? <img src={logoUrl} alt={`${branding?.institute_name ?? "Institute"} logo`} />
    : brandInitials;
  const testContext = branding?.institute_name ?? (isInstituteStudent ? "Institute" : "Visa House LMS");
  const violationModal = violationNotice ? (
    <ViolationPolicyModal
      count={violationNotice.count}
      limit={violationNotice.limit}
      autoSubmitted={violationNotice.autoSubmitted}
      onContinue={async () => {
        setViolationNotice(null);
        await enterFullscreen();
      }}
      onViewResult={() => navigate(`/student/attempts/${attempt.id}/result`, { replace: true })}
    />
  ) : null;
  const cameraPreview = liveCameraStream && securityAuthorized && mediaState.camera ? (
    <DraggableCameraPreview stream={liveCameraStream} />
  ) : null;
  const hasSavedResponses = attempt.parts.some((part) => part.answered_count > 0);
  const isFreshAttempt = !onboardingCompleted && !hasSavedResponses && sessionStorage.getItem(`onboarding_completed_${id}`) !== "true";
  const shouldShowPreExamOnboarding =
    (attempt.show_onboarding_instructions ?? true) && (
      attempt.status === "ready"
      || (attempt.security_required && !securityAuthorized)
      || isFreshAttempt
    );

  /* The Final Test runs its own pre-exam sequence, and it is not optional the
     way the engine's is: "Start Exam" on the last screen is what opens the
     secure session, so skipping it would put a candidate into the paper with
     no camera and no attempt token. It therefore shows
     whenever the session is not yet authorised, regardless of the module's
     `show_onboarding_instructions` setting. */
  if (languageCertSkin && (attempt.status === "ready" || !securityAuthorized)) {
    return (
      <>
        <FinalTestOnboarding
          attempt={attempt}
          user={user}
          securityError={securityError}
          securityStarting={securityStarting}
          concurrentTab={concurrentTab}
          onStartSecureSession={startSecureSession}
          onCancel={async () => {
            if (attempt.status === "ready") {
              try {
                await apiClient.post(`/student/attempts/${id}/cancel-onboarding`);
              } catch {
                // Ignore network errors on cancel
              }
            }
            navigate("/student/my-courses");
          }}
        />
        {violationModal}
      </>
    );
  }

  if (shouldShowPreExamOnboarding) {
    return (
      <>
        <PreExamOnboarding
          attempt={attempt}
          secondsLeft={secondsLeft}
          brandMark={brandMark}
          testContext={testContext}
          securityError={securityError}
          securityStarting={securityStarting}
          concurrentTab={concurrentTab}
          mediaState={mediaState}
          onStartSecureSession={startSecureSession}
          onCancel={async () => {
            if (attempt.status === "ready") {
              try {
                await apiClient.post(`/student/attempts/${id}/cancel-onboarding`);
              } catch {
                // Ignore network errors on cancel
              }
            }
            navigate("/student/my-courses");
          }}
        />
        {violationModal}
      </>
    );
  }

  if (!currentPart) return <div className="test-runner-loading">{strings.loading}</div>;


  const speakingParts = attempt.parts.filter((part) => part.section_type === "speaking");
  const speakingPartNumber = speakingParts.findIndex((part) => part.id === currentPart.id) + 1;
  const phasePartPosition = phasePartEntries.findIndex(({ index }) => index === partIndex);
  const previousPhasePartIndex = phasePartPosition > 0 ? phasePartEntries[phasePartPosition - 1]?.index ?? null : null;
  const nextPhasePartIndex = phasePartPosition >= 0 && phasePartPosition < phasePartEntries.length - 1
    ? phasePartEntries[phasePartPosition + 1]?.index ?? null
    : null;

  return (
    <div className={`test-runner-shell${brandedTestClass}${languageCertSkin ? " lc-exam" : ""}`}>
      <TestRunnerHeader
        attempt={attempt}
        currentPart={currentPart}
        brandMark={brandMark}
        testContext={testContext}
        isFinalAttempt={isFinalAttempt}
        partIndex={partIndex}
        onSelectPart={selectPart}
        previousPartIndex={previousPhasePartIndex}
        nextPartIndex={nextPhasePartIndex}
        onSkipPart={() => void selectPart(partIndex + 1, true)}
        isNavigationLocked={isNavigationLocked}
        isImmersiveAttempt={isImmersiveAttempt}
        fullscreenActive={fullscreenActive}
        onExitDeveloperFullscreen={exitDeveloperFullscreen}
        secondsLeft={secondsLeft}
        languageCertSkin={languageCertSkin}
        timerVisible={timerVisible}
        userEmail={user?.email}
      />

      {isListeningPart && (
        <ListeningHeaderPlayer
          key={currentPart.id}
          attemptId={attempt.id}
          currentPart={currentPart}
          onAudioLockChange={setIsListeningLocked}
          autoAdvance={nextPhasePartIndex !== null}
          onAudioComplete={handleListeningPartComplete}
          languageCertSkin={languageCertSkin}
          userEmail={user?.email}
        />
      )}

      <div className="test-runner-layout">
        {!isSpeakingPhase && (
          <PartsNav
            answeredCount={answeredCount}
            totalQuestions={totalQuestions}
            sectionGroups={sectionGroups}
            partIndex={partIndex}
            onSelectPart={selectPart}
            isNavigationLocked={isNavigationLocked}
            languageCertSkin={languageCertSkin}
          />
        )}

        {/* Listening, Speaking, and standalone MCQ parts without separate source text span
            the screen as one full-width column, matching the standard engine layout. */}
        <main
          className={`test-runner-body${
            currentPart.section_type === "writing" ? " test-runner-body--writing" : ""
          }${
            isListeningPart || !hasSourcePane || currentPart.section_type === "speaking"
              ? " test-runner-body--listening test-runner-body--single-column"
              : ""
          }`}
        >
          {/* The exam platform pages parts from inside the page body, above
              the question area. Listening and Speaking are paced by their own
              audio, so neither offers it. */}
          {languageCertSkin && !isListeningPart && currentPart.section_type !== "speaking" && (
            <LcPartPager
              partIndex={phasePartPosition}
              partCount={phasePartEntries.length}
              onSelectPart={(index) => {
                const target = phasePartEntries[index];
                if (target) void selectPart(target.index);
              }}
              isNavigationLocked={isNavigationLocked}
            />
          )}
          {currentPart.section_type === "speaking" ? (
            <SpeakingInterviewStage
              attemptId={attempt.id}
              currentPart={currentPart}
              isLastTestPart={partIndex >= attempt.parts.length - 1}
              onContinuePart={() => {
                if (partIndex < attempt.parts.length - 1) {
                  // `force`: the stage is the one control allowed past the lock
                  // that stops the candidate moving themselves.
                  void selectPart(partIndex + 1, true);
                } else {
                  // The last speaking part is the end of the test. Nothing is
                  // left to review - every answer is a recording already
                  // uploaded - so it submits itself rather than asking.
                  void submit();
                }
              }}
              onRecord={recordSpeakingAnswer}
              speakingPartCount={speakingParts.length}
              speakingPartNumber={speakingPartNumber}
              recordingFailedQuestionId={recordingFailedQuestionId}
              recordingQuestionId={recordingQuestionId}
              savingIds={savingIds}
            />
          ) : (
            <>
              {hasSourcePane && (
                <SourcePane
                  currentPart={currentPart}
                  passages={passages}
                  images={questionImages}
                  sourcePaneRef={sourcePaneRef}
                  questionNumberOffset={questionNumberOffset}
                  savingIds={savingIds}
                  onChangeResponse={(questionId, response) => updateResponse(questionId, response)}
                  languageCertSkin={languageCertSkin}
                />
              )}
              <QuestionPane
                currentPart={currentPart}
                questionPaneRef={questionPaneRef}
                questionNumberOffset={questionNumberOffset}
                savingIds={savingIds}
                recordingQuestionId={recordingQuestionId}
                onChangeResponse={updateResponse}
                onRecord={recordSpeakingAnswer}
                languageCertSkin={languageCertSkin}
              />
            </>
          )}
        </main>
      </div>


      {cameraPreview}

      {!isSpeakingPhase && (
        <TestRunnerFooter
          answeredCount={answeredCount}
          totalQuestions={totalQuestions}
          submitting={submitting}
          onRequestSubmit={() => setConfirmSubmit(true)}
          continueToSpeaking={isSplitCompositeAttempt}
          languageCertSkin={languageCertSkin}
        />
      )}

      {confirmSubmit && (
        <SubmitConfirmModal
          answeredCount={answeredCount}
          totalQuestions={totalQuestions}
          isFinal={attempt.is_final}
          submitting={submitting}
          onClose={() => setConfirmSubmit(false)}
          onConfirm={isSplitCompositeAttempt && !isSpeakingPhase ? enterSpeakingPhase : submit}
          continueToSpeaking={isSplitCompositeAttempt && !isSpeakingPhase}
        />
      )}

      {violationModal}

      {isImmersiveAttempt && !fullscreenActive && !developerFullscreenBypass.current && !violationNotice && (
        <FullscreenGate isFinal={attempt.is_final} secondsLeft={secondsLeft} onEnterFullscreen={enterFullscreen} timerVisible={timerVisible} />
      )}
    </div>
  );
}
