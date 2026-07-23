import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL, apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import type { Attempt, AttemptQuestion, AttemptResponse, ProctorFlagType } from "../../api/types";
import { useInstituteBranding } from "../../hooks/useInstituteBranding";
import { useAuthStore } from "../../store/authStore";
import { useToastStore } from "../../store/toastStore";
import { hasAttemptResponse } from "./attemptMetrics";
import { SpeakingAvatar } from "../../components/speaking/SpeakingAvatar";

const DEBOUNCE_MS = 800;
const HEARTBEAT_MS = 5_000;
const TAB_LEASE_MS = 12_000;
const IMMERSIVE_MODULE_TYPES = new Set(["full_mock", "final_test"]);
const SECTION_LABELS: Record<string, string> = {
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  speaking: "Speaking",
};

function formatTime(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = clamped % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function parseServerTimestamp(value: string): number {
  const hasTimezone = /(?:z|[+-]\d{2}:\d{2})$/i.test(value);
  return new Date(hasTimezone ? value : `${value}Z`).getTime();
}

type SecurityMediaState = {
  camera: boolean;
  microphone: boolean;
  screen: boolean;
  fullscreen: boolean;
  displaySurface: string | null;
};

const EMPTY_MEDIA_STATE: SecurityMediaState = {
  camera: false,
  microphone: false,
  screen: false,
  fullscreen: false,
  displaySurface: null,
};

function randomId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function securityStorageKey(attemptId: string | undefined, name: string): string {
  return `final-test:${attemptId ?? "unknown"}:${name}`;
}

function storedClientId(attemptId: string | undefined): string {
  const key = securityStorageKey(attemptId, "client-id");
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const value = randomId();
  sessionStorage.setItem(key, value);
  return value;
}

export function TestRunner() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isInstituteStudent = user?.institute_id != null;
  const { branding, logoUrl } = useInstituteBranding(isInstituteStudent ? user?.institute_slug : null);
  const showError = useToastStore((state) => state.showError);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [partIndex, setPartIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
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
      .catch(() => setError("Unable to load this test attempt."));
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
      showError(extractErrorMessage(err, "Failed to submit your test."), "Submit Failed");
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
      const message = "Allow full-screen access to continue this timed test.";
      setSecurityError(message);
      showError(message, "Full Screen Required");
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
        throw new Error("This browser does not support the camera and entire-screen security check.");
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
          throw new Error("Both a working camera and microphone are required.");
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
          throw new Error("Choose Entire Screen in the browser sharing dialog. A tab or window is not accepted.");
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
        throw new Error("Camera, microphone, and Entire Screen sharing must all remain active.");
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
          throw new Error("Camera, microphone, and Entire Screen sharing are active. Click Enter full screen and continue to finish the security check.");
        }
      }
      if (!document.fullscreenElement) {
        throw new Error("Camera, microphone, and Entire Screen sharing are active. Click Enter full screen and continue to finish the security check.");
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
      setSecurityError(extractErrorMessage(err, err instanceof Error ? err.message : "The security check could not be completed."));
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
          setSecurityError(extractErrorMessage(err, "The secure attempt session needs to be restored."));
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
      if (status !== 409) showError(extractErrorMessage(err, "Failed to save your answer."), "Save Failed");
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
          showError(extractErrorMessage(err, "Failed to upload your recording."), "Upload Failed");
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
      showError("Microphone access is required to record a Speaking answer.", "Microphone Blocked");
    }
  }

  const currentPart = attempt?.parts[partIndex];
  const answeredCount = useMemo(
    () => attempt?.parts.reduce((sum, part) => sum + part.answered_count, 0) ?? 0,
    [attempt],
  );
  const totalQuestions = useMemo(() => attempt?.parts.reduce((sum, part) => sum + part.question_count, 0) ?? 0, [attempt]);
  const sectionGroups = useMemo(() => {
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
          label: SECTION_LABELS[part.section_type] ?? part.section_type,
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
        showError(extractErrorMessage(err, "Unable to load this test part."), "Part Locked");
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
  if (!attempt) return <div className="test-runner-loading">Loading your test...</div>;

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
      <div className={`test-security-page${brandedTestClass}`}>
        <header className="test-security-header">
          <div className="test-runner-brand">
            <span className="test-runner-brand-mark">{brandMark}</span>
            <div><h1>{attempt.module_title}</h1><p>{testContext} · Final Test security check</p></div>
          </div>
          {attempt.status === "in_progress" && (
            <div className={`test-runner-timer${secondsLeft < 300 ? " is-urgent" : ""}`}>
              <span>Time left</span><strong>{formatTime(secondsLeft)}</strong>
            </div>
          )}
        </header>
        <main className="test-security-main">
          <section className="test-security-card" aria-labelledby="security-check-title">
            <div className="test-security-copy">
              <span className="page-eyebrow">Secure Final Test</span>
              <h2 id="security-check-title">Complete the security check</h2>
              <p>The timer starts only after the first successful check. Camera, microphone, full screen, and Entire Screen sharing must remain active.</p>
            </div>

            <div className="test-security-content">
              <div className="test-security-preview">
                <video ref={cameraPreviewRef} muted playsInline aria-label="Camera preview" />
                <span>{mediaState.camera ? "Camera active" : "Camera preview"}</span>
              </div>
              <div className="test-security-checks" aria-label="Required security controls">
                <SecurityCheck label="Camera" active={mediaState.camera} />
                <SecurityCheck label="Microphone" active={mediaState.microphone} />
                <SecurityCheck label="Entire Screen" active={mediaState.screen && mediaState.displaySurface === "monitor"} />
                <SecurityCheck label="Full screen" active={mediaState.fullscreen} />
              </div>
            </div>

            {concurrentTab && <p className="test-security-alert">Close the other Final Test tab before continuing.</p>}
            {securityError && <p className="test-security-alert">{securityError}</p>}
            <p className="test-security-privacy">Media remains active for supervision during the attempt. Permission indicators stay visible in your browser.</p>
            <div className="test-security-actions">
              <button type="button" onClick={startSecureSession} disabled={securityStarting || concurrentTab}>
                {securityStarting
                  ? "Activating security controls..."
                  : mediaPermissionsReady && !fullscreenActive
                    ? "Enter full screen and continue"
                  : attempt.status === "ready"
                    ? "Enable all and start Final Test"
                    : "Enable all and restore session"}
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (!currentPart) return <div className="test-runner-loading">Loading your test...</div>;

  return (
    <div className={`test-runner-shell${brandedTestClass}`}>
      <header className="test-runner-header">
        <div className="test-runner-brand">
          <span className="test-runner-brand-mark">{brandMark}</span>
          <div>
            <h1>{attempt.module_title}</h1>
            <p>{testContext} · {SECTION_LABELS[currentPart.section_type]} · {currentPart.title}</p>
          </div>
        </div>
        <div className="test-runner-header-actions">
          {isFinalAttempt && (
            <div className="test-security-live" title="Final Test security controls are active">
              <span /> Secure
            </div>
          )}
          <div className="test-runner-header-navigation" aria-label="Part navigation">
            <button type="button" className="secondary-button" disabled={partIndex === 0} onClick={() => selectPart(partIndex - 1)}>
              Previous
            </button>
            <button type="button" disabled={partIndex === attempt.parts.length - 1} onClick={() => selectPart(partIndex + 1)}>
              Next
            </button>
          </div>
          {import.meta.env.DEV && isImmersiveAttempt && fullscreenActive && (
            <button type="button" className="test-runner-dev-exit" onClick={exitDeveloperFullscreen}>
              Exit full screen (dev)
            </button>
          )}
          <div className={`test-runner-timer${secondsLeft < 300 ? " is-urgent" : ""}`} aria-label="Time remaining">
            <span>Time left</span>
            <strong>{formatTime(secondsLeft)}</strong>
          </div>
        </div>
      </header>

      <div className="test-runner-layout">
        <nav className="test-runner-parts" aria-label="Test sections">
          <div className="test-runner-progress-summary">
            <span>Progress</span>
            <strong>{answeredCount}/{totalQuestions}</strong>
          </div>
          {sectionGroups.map((group) => (
            <section className="test-runner-section-group" key={group.section}>
              <h2>{group.label}</h2>
              {group.parts.map(({ part, index }) => {
                const complete = part.question_count > 0 && part.answered_count === part.question_count;
                return (
                  <button
                    type="button"
                    key={part.id}
                    className={`test-runner-part-tab${index === partIndex ? " is-active" : ""}${complete ? " is-complete" : ""}`}
                    onClick={() => selectPart(index)}
                    aria-current={index === partIndex ? "step" : undefined}
                  >
                    <span>{part.title}</span>
                    <span className="test-runner-part-progress">
                      {part.answered_count}/{part.question_count}
                    </span>
                  </button>
                );
              })}
            </section>
          ))}
        </nav>

        <main className="test-runner-body">
          <section className="test-runner-source-pane" ref={sourcePaneRef}>
            <div className="test-runner-pane-heading">
              <span>{currentPart.part_code.replaceAll("_", " ")}</span>
              <h2>{passages.length > 0 ? "Source material" : "Part instructions"}</h2>
              {currentPart.skill_focus && <p>{currentPart.skill_focus}</p>}
            </div>
            {currentPart.section_type === "speaking" && (
              <SpeakingAvatar attemptId={attempt.id} partId={currentPart.id} />
            )}
            {currentPart.instructions && <p className="test-runner-instructions">{currentPart.instructions}</p>}
            {currentPart.assets.map((asset) => (
              <div className="test-runner-asset" key={asset.id}>
                <p>{asset.title}</p>
                {asset.asset_type === "avatar_mp4" ? (
                  <video controls src={`${API_BASE_URL}${asset.url}`} />
                ) : (
                  <audio controls src={`${API_BASE_URL}${asset.url}`} />
                )}
              </div>
            ))}
            {passages.length > 0 ? passages.map((passage, index) => (
              <article className="test-runner-passage" key={`${currentPart.id}-${index}`}>
                {passages.length > 1 && <strong>Passage {index + 1}</strong>}
                <p>{passage}</p>
              </article>
            )) : (
              <div className="test-runner-source-placeholder">
                <strong>{SECTION_LABELS[currentPart.section_type]} task</strong>
                <p>Read each prompt carefully and complete every item in this part. Your answers save automatically.</p>
              </div>
            )}
          </section>

          <section className="test-runner-question-pane" ref={questionPaneRef} aria-label={`${currentPart.title} questions`}>
            <div className="test-runner-pane-heading test-runner-question-pane-heading">
              <span>{currentPart.question_count} questions</span>
              <h2>{currentPart.title}</h2>
              <p>Choose or enter the best answer for each question.</p>
            </div>
            {currentPart.questions.map((question, qIndex) => (
              <QuestionInput
                key={question.id}
                index={questionNumberOffset + qIndex + 1}
                question={question}
                saving={savingIds.has(question.id)}
                recording={recordingQuestionId === question.id}
                onChange={(response, debounce) => updateResponse(question.id, response, debounce)}
                onRecord={() => recordSpeakingAnswer(question.id)}
              />
            ))}
          </section>
        </main>
      </div>

      {isFinalAttempt && (
        <div className="test-security-watermark" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <span key={index}>
              {user?.first_name} {user?.last_name} · Student {user?.id} · Attempt {attempt.id} · {watermarkTime.toLocaleTimeString()}
            </span>
          ))}
        </div>
      )}

      <footer className="test-runner-footer">
        <span>{answeredCount} of {totalQuestions} answered</span>
        <div>
          <button className="secondary-button" disabled={partIndex === 0} onClick={() => selectPart(partIndex - 1)}>Previous part</button>
          {partIndex < attempt.parts.length - 1 ? (
            <button onClick={() => selectPart(partIndex + 1)}>Next part</button>
          ) : (
            <button onClick={() => setConfirmSubmit(true)} disabled={submitting}>{submitting ? "Submitting..." : "Submit test"}</button>
          )}
        </div>
      </footer>

      {confirmSubmit && (
        <div className="modal-backdrop" onClick={() => setConfirmSubmit(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>Submit this test?</h2>
            <p>You've answered {answeredCount} of {totalQuestions} questions. {attempt.is_final ? "The Final Test cannot be resumed once left." : "You won't be able to change your answers after submitting."}</p>
            <div className="form-actions">
              <button className="secondary-button" onClick={() => setConfirmSubmit(false)}>Keep working</button>
              <button onClick={submit} disabled={submitting}>{submitting ? "Submitting..." : "Submit now"}</button>
            </div>
          </div>
        </div>
      )}

      {isImmersiveAttempt && !fullscreenActive && !developerFullscreenBypass.current && (
        <div className="test-runner-fullscreen-gate" role="dialog" aria-modal="true" aria-labelledby="fullscreen-gate-title">
          <section>
            <span className="page-eyebrow">{attempt.is_final ? "Final Test" : "Full Mock Test"}</span>
            <h2 id="fullscreen-gate-title">Continue in full screen</h2>
            <p>Your timed session is active. Enter full screen to view and complete the assessment.</p>
            <div className={`test-runner-gate-timer${secondsLeft < 300 ? " is-urgent" : ""}`}>{formatTime(secondsLeft)}</div>
            <button type="button" onClick={enterFullscreen}>Enter full screen</button>
          </section>
        </div>
      )}
    </div>
  );
}

function SecurityCheck({ label, active }: { label: string; active: boolean }) {
  return (
    <div className={`test-security-check${active ? " is-active" : ""}`}>
      <span aria-hidden="true" />
      <strong>{label}</strong>
      <small>{active ? "Ready" : "Required"}</small>
    </div>
  );
}

function QuestionInput({
  index,
  question,
  saving,
  recording,
  onChange,
  onRecord,
}: {
  index: number;
  question: AttemptQuestion;
  saving: boolean;
  recording: boolean;
  onChange: (response: AttemptResponse, debounce?: boolean) => void;
  onRecord: () => void;
}) {
  const selected = question.response?.selected;

  return (
    <div className="test-runner-question">
      <div className="test-runner-question-head">
        <span>Question {index}</span>
        {saving && <span className="hint">Saving...</span>}
      </div>
      <p className="test-runner-prompt">{question.prompt}</p>
      {question.instructions && <p className="hint">{question.instructions}</p>}

      {(question.question_type === "mcq_single" ||
        question.question_type === "true_false_not_given" ||
        question.question_type === "yes_no_not_given") && (
        <div className="test-runner-options">
          {question.options.map((option) => (
            <label key={option.key} className="test-runner-option">
              <input
                type="radio"
                name={`q-${question.id}`}
                checked={selected === option.key}
                onChange={() => onChange({ selected: option.key })}
              />
              {option.text}
            </label>
          ))}
        </div>
      )}

      {question.question_type === "mcq_multiple" && (
        <div className="test-runner-options">
          {question.options.map((option) => {
            const list = Array.isArray(selected) ? selected : [];
            const checked = list.includes(option.key);
            return (
              <label key={option.key} className="test-runner-option">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked ? [...list, option.key] : list.filter((k) => k !== option.key);
                    onChange({ selected: next });
                  }}
                />
                {option.text}
              </label>
            );
          })}
        </div>
      )}

      {(question.question_type === "short_answer" || question.question_type === "fill_blank") && (
        <input
          type="text"
          className="test-runner-text-input"
          defaultValue={question.response?.text ?? ""}
          onChange={(e) => onChange({ text: e.target.value }, true)}
        />
      )}

      {question.question_type === "essay" && (
        <div>
          <textarea
            className="test-runner-essay"
            rows={10}
            defaultValue={question.response?.text ?? ""}
            onChange={(e) => onChange({ text: e.target.value }, true)}
          />
          <p className="hint">{(question.response?.text ?? "").trim().split(/\s+/).filter(Boolean).length} words</p>
        </div>
      )}

      {question.question_type === "speaking_prompt" && (
        <div className="test-runner-speaking">
          <button type="button" className={recording ? "danger" : ""} onClick={onRecord}>
            {recording ? "Stop recording" : question.audio_path ? "Re-record answer" : "Record your answer"}
          </button>
          {question.audio_path && !recording && <audio controls src={`${API_BASE_URL}${question.audio_path}`} />}
        </div>
      )}
    </div>
  );
}
