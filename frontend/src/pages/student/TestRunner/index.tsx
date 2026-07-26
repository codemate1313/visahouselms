import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import type { Attempt, AttemptResponse, ProctorFlagType } from "@/api/types";
import { useInstituteBranding } from "@/hooks/useInstituteBranding";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { hasAttemptResponse } from "@/pages/student/attemptMetrics";
import { testRunnerStrings as strings } from "./TestRunner.strings";
import {
  EMPTY_MEDIA_STATE,
  IMMERSIVE_MODULE_TYPES,
  TAB_LEASE_MS,
  HEARTBEAT_MS,
  DEBOUNCE_MS,
  parseServerTimestamp,
  randomId,
  securityStorageKey,
  storedClientId,
  type SecurityMediaState,
} from "./helpers";
import { SecurityCheckPage } from "./components/SecurityCheckPage";
import { TestRunnerHeader } from "./components/TestRunnerHeader";
import { PartsNav } from "./components/PartsNav";
import { SourcePane } from "./components/SourcePane";
import { QuestionPane } from "./components/QuestionPane";
import { TestRunnerFooter } from "./components/TestRunnerFooter";
import { SubmitConfirmModal } from "./components/SubmitConfirmModal";
import { FullscreenGate } from "./components/FullscreenGate";
import { SecurityWatermark } from "./components/SecurityWatermark";

export function TestRunner() {
  const { id } = useParams();
  const navigate = useNavigate();
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
  const [partIndex, setPartIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  if (isMobileDevice) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--background, #0f172a)",
        color: "var(--text, #ffffff)",
        padding: "24px",
        textAlign: "center",
        fontFamily: "'Inter', system-ui, sans-serif"
      }}>
        <div style={{
          maxWidth: "440px",
          background: "var(--surface, #1e293b)",
          padding: "40px 32px",
          borderRadius: "24px",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.3)",
          border: "1px solid var(--border, rgba(255, 255, 255, 0.08))",
          display: "flex",
          flexDirection: "column",
          alignItems: "center"
        }}>
          {/* Monitor/Computer Icon */}
          <div style={{
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            background: "color-mix(in srgb, var(--primary, #e11d2e) 15%, transparent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "24px"
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--primary, #e11d2e)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>

          <h2 style={{
            fontSize: "24px",
            fontWeight: "800",
            marginBottom: "12px",
            letterSpacing: "-0.5px"
          }}>Computer Required</h2>

          <p style={{
            fontSize: "15px",
            lineHeight: "1.6",
            color: "var(--text-secondary, #94a3b8)",
            marginBottom: "32px"
          }}>
            To perform this IELTS test, you must use a desktop or laptop computer. Mobile and tablet devices are not supported for timed exam attempts.
          </p>

          <button
            onClick={() => navigate("/student/dashboard")}
            style={{
              width: "100%",
              padding: "14px 28px",
              borderRadius: "12px",
              background: "var(--primary, #e11d2e)",
              color: "#ffffff",
              fontSize: "15px",
              fontWeight: "600",
              border: "none",
              cursor: "pointer",
              transition: "transform 0.2s, filter 0.2s"
            }}
            onMouseOver={(e) => e.currentTarget.style.filter = "brightness(1.15)"}
            onMouseOut={(e) => e.currentTarget.style.filter = "none"}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const debounceTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [recordingQuestionId, setRecordingQuestionId] = useState<number | null>(null);
  const [fullscreenActive, setFullscreenActive] = useState(() => Boolean(document.fullscreenElement));
  const [securityAuthorized, setSecurityAuthorized] = useState(false);
  const [securityStarting, setSecurityStarting] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [mediaState, setMediaState] = useState<SecurityMediaState>(EMPTY_MEDIA_STATE);
  const [concurrentTab, setConcurrentTab] = useState(false);
  const [watermarkTime, setWatermarkTime] = useState(() => new Date());
  const submittedRef = useRef(false);
  const developerFullscreenBypass = useRef(false);
  const sourcePaneRef = useRef<HTMLElement | null>(null);
  const questionPaneRef = useRef<HTMLElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
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

  const securityHeaders = useCallback(() => (
    attemptTokenRef.current ? { "X-Attempt-Token": attemptTokenRef.current } : {}
  ), []);

  const activeHeartbeatPartId = attempt?.parts[partIndex]?.id ?? null;

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
        setSecurityAuthorized(data.security_authorized);
        setAttempt(data);
      })
      .catch(() => setError(strings.loadError));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, navigate, securityHeaders]);

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      await apiClient.post(`/student/attempts/${id}/submit`, undefined, { headers: securityHeaders() });
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

  // Countdown timer, driven by the server's expires_at - purely a display,
  // the server rejects writes past its own clock independently.
  useEffect(() => {
    if (!attempt || attempt.status !== "in_progress") return;
    function tick() {
      if (!attempt) return;
      const remaining = (parseServerTimestamp(attempt.expires_at) - Date.now()) / 1000;
      setSecondsLeft(remaining);
      if (remaining <= 0) submit();
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [attempt, submit]);

  const recordFlag = useCallback(
    (flagType: ProctorFlagType, meta?: Record<string, unknown>) => {
      if (!attemptTokenRef.current) return;
      eventSequenceRef.current += 1;
      sessionStorage.setItem(securityStorageKey(id, "event-sequence"), String(eventSequenceRef.current));
      apiClient.post(
        `/student/attempts/${id}/flags`,
        {
          flag_type: flagType,
          meta,
          client_sequence: eventSequenceRef.current,
          client_occurred_at: new Date().toISOString(),
        },
        { headers: { ...securityHeaders(), "X-Skip-Loader": "1" } },
      ).catch(() => {});
    },
    [id, securityHeaders],
  );

  const isImmersiveAttempt = attempt ? IMMERSIVE_MODULE_TYPES.has(attempt.module_type) : false;
  const immersiveAttemptId = isImmersiveAttempt ? attempt?.id : null;
  const isFinalAttempt = attempt?.is_final ?? false;

  const updateSecurityMedia = useCallback((next: Partial<SecurityMediaState>) => {
    const merged = { ...mediaStateRef.current, ...next };
    mediaStateRef.current = merged;
    setMediaState(merged);
  }, []);

  const onRequiredTrackEnded = useCallback((kind: "camera" | "microphone" | "screen") => {
    updateSecurityMedia({ [kind]: false });
    const flag: ProctorFlagType = kind === "camera"
      ? "camera_stopped"
      : kind === "microphone"
        ? "microphone_stopped"
        : "screen_share_stopped";
    recordFlag(flag, { ready_state: "ended" });
  }, [recordFlag, updateSecurityMedia]);

  // Composite tests occupy the full viewport. Final Tests additionally retain
  // strict proctor flagging and mandatory live media throughout the sitting.
  useEffect(() => {
    if (!immersiveAttemptId) return;
    developerFullscreenBypass.current = false;
    setFullscreenActive(Boolean(document.fullscreenElement));

    function onFullscreenChange() {
      const isActive = Boolean(document.fullscreenElement);
      setFullscreenActive(isActive);
      updateSecurityMedia({ fullscreen: isActive });
      if (!isActive && isFinalAttempt && !submittedRef.current && !developerFullscreenBypass.current) {
        recordFlag("fullscreen_exit");
      }
    }
    function onVisibilityChange() {
      if (isFinalAttempt && document.hidden && !submittedRef.current) recordFlag("visibility_change");
    }
    function onBlur() {
      if (isFinalAttempt && !submittedRef.current) recordFlag("blur");
    }
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!isFinalAttempt || submittedRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    function onClipboard(event: ClipboardEvent) {
      if (!isFinalAttempt || submittedRef.current) return;
      event.preventDefault();
      recordFlag("clipboard", { operation: event.type });
    }
    function onContextMenu(event: MouseEvent) {
      if (!isFinalAttempt || submittedRef.current) return;
      event.preventDefault();
      recordFlag("context_menu");
    }
    function onKeyDown(event: KeyboardEvent) {
      if (!isFinalAttempt || submittedRef.current) return;
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === "p") {
        event.preventDefault();
        recordFlag("print_attempt");
      } else if (event.key === "PrintScreen") {
        event.preventDefault();
        recordFlag("print_attempt", { key: "PrintScreen" });
      }
    }

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("copy", onClipboard);
    document.addEventListener("cut", onClipboard);
    document.addEventListener("paste", onClipboard);
    document.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("copy", onClipboard);
      document.removeEventListener("cut", onClipboard);
      document.removeEventListener("paste", onClipboard);
      document.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("keydown", onKeyDown);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [immersiveAttemptId, isFinalAttempt, recordFlag, updateSecurityMedia]);

  async function enterFullscreen() {
    developerFullscreenBypass.current = false;
    setSecurityError(null);
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      setFullscreenActive(Boolean(document.fullscreenElement));
      updateSecurityMedia({ fullscreen: Boolean(document.fullscreenElement) });
    } catch {
      const message = strings.errors.fullscreenRequired;
      setSecurityError(message);
      showError(message, strings.errors.fullscreenRequiredTitle);
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
    screenStreamRef.current?.getTracks().forEach((track) => {
      track.onended = null;
      track.onmute = null;
      track.stop();
    });
    cameraStreamRef.current = null;
    screenStreamRef.current = null;
    if (cameraPreviewRef.current) cameraPreviewRef.current.srcObject = null;
    mediaStateRef.current = EMPTY_MEDIA_STATE;
    setMediaState(EMPTY_MEDIA_STATE);
  }

  async function startSecureSession() {
    if (!attempt?.is_final || securityStarting) return;
    setSecurityStarting(true);
    setSecurityError(null);
    setConcurrentTab(false);

    let cameraStream = cameraStreamRef.current;
    let screenStream = screenStreamRef.current;
    let keepMediaActive = false;

    try {
      if (!navigator.mediaDevices?.getUserMedia || !navigator.mediaDevices?.getDisplayMedia) {
        throw new Error(strings.security.errors.browserUnsupported);
      }

      let cameraTrack = cameraStream?.getVideoTracks()[0];
      let microphoneTrack = cameraStream?.getAudioTracks()[0];
      let screenTrack = screenStream?.getVideoTracks()[0];
      let displaySurface = (screenTrack?.getSettings() as MediaTrackSettings & { displaySurface?: string })?.displaySurface;
      const existingMediaActive = cameraTrack?.readyState === "live"
        && microphoneTrack?.readyState === "live"
        && screenTrack?.readyState === "live"
        && displaySurface === "monitor";

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

        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: "monitor",
          },
          audio: false,
          monitorTypeSurfaces: "include",
          selfBrowserSurface: "exclude",
          surfaceSwitching: "exclude",
        } as DisplayMediaStreamOptions);
        screenTrack = screenStream.getVideoTracks()[0];
        displaySurface = (screenTrack?.getSettings() as MediaTrackSettings & { displaySurface?: string })?.displaySurface;
        if (!screenTrack || displaySurface !== "monitor") {
          recordFlag("screen_surface_invalid", { surface: displaySurface ?? "unknown" });
          throw new Error(strings.security.errors.screenSurfaceInvalid);
        }

        cameraStreamRef.current = cameraStream;
        screenStreamRef.current = screenStream;
        cameraTrack.onended = () => onRequiredTrackEnded("camera");
        cameraTrack.onmute = () => onRequiredTrackEnded("camera");
        microphoneTrack.onended = () => onRequiredTrackEnded("microphone");
        microphoneTrack.onmute = () => onRequiredTrackEnded("microphone");
        screenTrack.onended = () => onRequiredTrackEnded("screen");
        screenTrack.onmute = () => onRequiredTrackEnded("screen");
      }

      if (!cameraStream || !screenStream || !cameraTrack || !microphoneTrack || !screenTrack) {
        throw new Error(strings.security.errors.mediaMustRemainActive);
      }

      keepMediaActive = true;
      if (cameraPreviewRef.current) {
        cameraPreviewRef.current.srcObject = cameraStream;
        cameraPreviewRef.current.play().catch(() => {});
      }
      updateSecurityMedia({
        camera: cameraTrack.readyState === "live" && cameraTrack.enabled,
        microphone: microphoneTrack.readyState === "live" && microphoneTrack.enabled,
        screen: screenTrack.readyState === "live" && screenTrack.enabled,
        fullscreen: Boolean(document.fullscreenElement),
        displaySurface,
      });

      if (!document.fullscreenElement) {
        try {
          await document.documentElement.requestFullscreen();
        } catch {
          throw new Error(strings.security.errors.fullscreenAfterMedia);
        }
      }
      if (!document.fullscreenElement) {
        throw new Error(strings.security.errors.fullscreenAfterMedia);
      }
      setFullscreenActive(true);
      updateSecurityMedia({ fullscreen: true });

      const { data: preflight } = await apiClient.post<{ attempt_token: string }>(
        `/student/attempts/${id}/security/preflight`,
        {
          client_id: securityClientIdRef.current,
          camera_active: true,
          microphone_active: true,
          screen_share_active: true,
          fullscreen_active: true,
          display_surface: "monitor",
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
      setSecurityAuthorized(true);
      setFullscreenActive(true);
    } catch (err: unknown) {
      if (!keepMediaActive) {
        cameraStream?.getTracks().forEach((track) => track.stop());
        screenStream?.getTracks().forEach((track) => track.stop());
        stopSecurityMedia();
      } else {
        const cameraTrack = cameraStreamRef.current?.getVideoTracks()[0];
        const microphoneTrack = cameraStreamRef.current?.getAudioTracks()[0];
        const screenTrack = screenStreamRef.current?.getVideoTracks()[0];
        updateSecurityMedia({
          camera: cameraTrack?.readyState === "live" && cameraTrack.enabled,
          microphone: microphoneTrack?.readyState === "live" && microphoneTrack.enabled,
          screen: screenTrack?.readyState === "live" && screenTrack.enabled,
          fullscreen: Boolean(document.fullscreenElement),
          displaySurface: (screenTrack?.getSettings() as MediaTrackSettings & { displaySurface?: string })?.displaySurface ?? null,
        });
      }
      setSecurityAuthorized(false);
      setSecurityError(extractErrorMessage(err, err instanceof Error ? err.message : strings.security.errors.generic));
    } finally {
      setSecurityStarting(false);
    }
  }

  useEffect(() => () => stopSecurityMedia(), []);

  useEffect(() => {
    if (!attempt?.is_final || attempt.status !== "in_progress" || !securityAuthorized || !attemptTokenRef.current) return;

    let cancelled = false;
    async function heartbeat() {
      if (cancelled || heartbeatBusyRef.current) return;
      heartbeatBusyRef.current = true;
      heartbeatSequenceRef.current += 1;
      const state = mediaStateRef.current;
      try {
        const { data } = await apiClient.post<{ risk_score: number }>(
          `/student/attempts/${id}/security/heartbeat`,
          {
            sequence: heartbeatSequenceRef.current,
            client_id: securityClientIdRef.current,
            camera_active: state.camera,
            microphone_active: state.microphone,
            screen_share_active: state.screen,
            fullscreen_active: Boolean(document.fullscreenElement),
            visible: !document.hidden,
            focused: document.hasFocus(),
            display_surface: state.displaySurface,
            current_part_id: activeHeartbeatPartId,
            client_at: new Date().toISOString(),
          },
          { headers: { ...securityHeaders(), "X-Skip-Loader": "1" } },
        );
        setAttempt((current) => current ? { ...current, security_risk_score: data.risk_score } : current);
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
  }, [attempt?.id, attempt?.is_final, attempt?.status, activeHeartbeatPartId, securityAuthorized, id, securityHeaders]);

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

  useEffect(() => {
    if (!attempt?.is_final || attempt.status !== "in_progress") return;
    const interval = window.setInterval(() => setWatermarkTime(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, [attempt?.id, attempt?.is_final, attempt?.status]);

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

  async function recordSpeakingAnswer(questionId: number) {
    if (recordingQuestionId === questionId) {
      recorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecordingQuestionId(null);
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        const form = new FormData();
        form.append("file", blob, "answer.webm");
        setSavingIds((prev) => new Set(prev).add(questionId));
        try {
          await apiClient.post(`/student/attempts/${id}/answers/${questionId}/audio`, form, { headers: securityHeaders() });
          setAttempt((current) => {
            if (!current) return current;
            return {
              ...current,
              parts: current.parts.map((part) => ({
                ...part,
                questions: part.questions.map((q) => (q.id === questionId ? { ...q, response: { recorded: true } } : q)),
              })),
            };
          });
        } catch (err: unknown) {
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
      recorder.start();
      setRecordingQuestionId(questionId);
    } catch {
      showError(strings.errors.microphoneBlocked, strings.errors.microphoneBlockedTitle);
    }
  }

  const currentPart = attempt?.parts[partIndex];
  const answeredCount = useMemo(
    () => attempt?.parts.reduce((sum, part) => sum + part.answered_count, 0) ?? 0,
    [attempt],
  );
  const totalQuestions = useMemo(() => attempt?.parts.reduce((sum, part) => sum + part.question_count, 0) ?? 0, [attempt]);
  const sectionGroups = useMemo(() => {
    const sectionLabels: Record<string, string> = strings.sectionLabels;
    const groups: Array<{
      section: string;
      label: string;
      parts: Array<{ part: Attempt["parts"][number]; index: number }>;
    }> = [];
    attempt?.parts.forEach((part, index) => {
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
  }, [attempt]);
  const passages = useMemo(
    () => Array.from(new Set((currentPart?.questions ?? []).map((question) => question.passage?.trim()).filter(Boolean))) as string[],
    [currentPart],
  );
  const questionNumberOffset = useMemo(
    () => attempt?.parts.slice(0, partIndex).reduce((sum, part) => sum + part.question_count, 0) ?? 0,
    [attempt, partIndex],
  );

  async function selectPart(index: number) {
    const selectedPart = attempt?.parts[index];
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

  if (error) return <p className="error-text">{error}</p>;
  if (!attempt) return <div className="test-runner-loading">{strings.loading}</div>;

  const strictSecurityActive = mediaState.camera
    && mediaState.microphone
    && mediaState.screen
    && mediaState.fullscreen
    && mediaState.displaySurface === "monitor"
    && !concurrentTab;
  const mediaPermissionsReady = mediaState.camera
    && mediaState.microphone
    && mediaState.screen
    && mediaState.displaySurface === "monitor";
  const brandedTestClass = isInstituteStudent ? " institute-branded-test" : "";
  const brandInitials = branding?.institute_name
    ? branding.institute_name.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase()
    : isInstituteStudent ? "IN" : "VH";
  const brandMark = logoUrl
    ? <img src={logoUrl} alt={`${branding?.institute_name ?? "Institute"} logo`} />
    : brandInitials;
  const testContext = branding?.institute_name ?? (isInstituteStudent ? "Institute" : "Visa House LMS");

  if (attempt.is_final && (attempt.status === "ready" || !securityAuthorized || !strictSecurityActive)) {
    return (
      <SecurityCheckPage
        attempt={attempt}
        brandedTestClass={brandedTestClass}
        brandMark={brandMark}
        testContext={testContext}
        secondsLeft={secondsLeft}
        mediaState={mediaState}
        cameraPreviewRef={cameraPreviewRef}
        concurrentTab={concurrentTab}
        securityError={securityError}
        securityStarting={securityStarting}
        mediaPermissionsReady={mediaPermissionsReady}
        fullscreenActive={fullscreenActive}
        onStartSecureSession={startSecureSession}
      />
    );
  }

  if (!currentPart) return <div className="test-runner-loading">{strings.loading}</div>;

  return (
    <div className={`test-runner-shell${brandedTestClass}`}>
      <TestRunnerHeader
        attempt={attempt}
        currentPart={currentPart}
        brandMark={brandMark}
        testContext={testContext}
        isFinalAttempt={isFinalAttempt}
        partIndex={partIndex}
        onSelectPart={selectPart}
        isImmersiveAttempt={isImmersiveAttempt}
        fullscreenActive={fullscreenActive}
        onExitDeveloperFullscreen={exitDeveloperFullscreen}
        secondsLeft={secondsLeft}
      />

      <div className="test-runner-layout">
        <PartsNav
          answeredCount={answeredCount}
          totalQuestions={totalQuestions}
          sectionGroups={sectionGroups}
          partIndex={partIndex}
          onSelectPart={selectPart}
        />

        <main className="test-runner-body">
          <SourcePane attemptId={attempt.id} currentPart={currentPart} passages={passages} sourcePaneRef={sourcePaneRef} />
          <QuestionPane
            currentPart={currentPart}
            questionPaneRef={questionPaneRef}
            questionNumberOffset={questionNumberOffset}
            savingIds={savingIds}
            recordingQuestionId={recordingQuestionId}
            onChangeResponse={updateResponse}
            onRecord={recordSpeakingAnswer}
          />
        </main>
      </div>

      {isFinalAttempt && (
        <SecurityWatermark
          firstName={user?.first_name}
          lastName={user?.last_name}
          userId={user?.id}
          attemptId={attempt.id}
          watermarkTime={watermarkTime}
        />
      )}

      <TestRunnerFooter
        answeredCount={answeredCount}
        totalQuestions={totalQuestions}
        partIndex={partIndex}
        isLastPart={partIndex >= attempt.parts.length - 1}
        submitting={submitting}
        onSelectPart={selectPart}
        onRequestSubmit={() => setConfirmSubmit(true)}
      />

      {confirmSubmit && (
        <SubmitConfirmModal
          answeredCount={answeredCount}
          totalQuestions={totalQuestions}
          isFinal={attempt.is_final}
          submitting={submitting}
          onClose={() => setConfirmSubmit(false)}
          onConfirm={submit}
        />
      )}

      {isImmersiveAttempt && !fullscreenActive && !developerFullscreenBypass.current && (
        <FullscreenGate isFinal={attempt.is_final} secondsLeft={secondsLeft} onEnterFullscreen={enterFullscreen} />
      )}
    </div>
  );
}
