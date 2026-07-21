import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL, apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import type { Attempt, AttemptQuestion, AttemptResponse, ProctorFlagType } from "../../api/types";
import { useToastStore } from "../../store/toastStore";

const DEBOUNCE_MS = 800;
const IMMERSIVE_MODULE_TYPES = new Set(["full_mock", "final_test"]);

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

export function TestRunner() {
  const { id } = useParams();
  const navigate = useNavigate();
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
  const submittedRef = useRef(false);
  const developerFullscreenBypass = useRef(false);

  useEffect(() => {
    apiClient
      .get<Attempt>(`/student/attempts/${id}`)
      .then(({ data }) => {
        if (data.status !== "in_progress") {
          navigate(`/student/attempts/${id}/result`, { replace: true });
          return;
        }
        setAttempt(data);
      })
      .catch(() => setError("Unable to load this test attempt."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      await apiClient.post(`/student/attempts/${id}/submit`);
      navigate(`/student/attempts/${id}/result`, { replace: true });
    } catch (err: unknown) {
      submittedRef.current = false;
      setSubmitting(false);
      showError(extractErrorMessage(err, "Failed to submit your test."), "Submit Failed");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Countdown timer, driven by the server's expires_at - purely a display,
  // the server rejects writes past its own clock independently.
  useEffect(() => {
    if (!attempt) return;
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
      apiClient.post(`/student/attempts/${id}/flags`, { flag_type: flagType, meta }, { headers: { "X-Skip-Loader": "1" } }).catch(() => {});
    },
    [id],
  );

  const isImmersiveAttempt = attempt ? IMMERSIVE_MODULE_TYPES.has(attempt.module_type) : false;
  const immersiveAttemptId = isImmersiveAttempt ? attempt?.id : null;
  const isFinalAttempt = attempt?.is_final ?? false;

  // Composite tests occupy the full viewport. Final Tests additionally retain
  // strict proctor flagging; Full Mocks use the same delivery surface without
  // treating practice interruptions as violations.
  useEffect(() => {
    if (!immersiveAttemptId) return;
    developerFullscreenBypass.current = false;
    setFullscreenActive(Boolean(document.fullscreenElement));

    function onFullscreenChange() {
      const isActive = Boolean(document.fullscreenElement);
      setFullscreenActive(isActive);
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

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [immersiveAttemptId, isFinalAttempt, recordFlag]);

  async function enterFullscreen() {
    developerFullscreenBypass.current = false;
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      setFullscreenActive(Boolean(document.fullscreenElement));
    } catch {
      showError("Allow full-screen access to continue this timed test.", "Full Screen Required");
    }
  }

  async function exitDeveloperFullscreen() {
    developerFullscreenBypass.current = true;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } finally {
      setFullscreenActive(false);
    }
  }

  async function persist(questionId: number, response: AttemptResponse) {
    setSavingIds((prev) => new Set(prev).add(questionId));
    try {
      await apiClient.put(
        `/student/attempts/${id}/answers/${questionId}`,
        { response },
        { headers: { "X-Skip-Loader": "1" } },
      );
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Failed to save your answer."), "Save Failed");
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(questionId);
        return next;
      });
    }
  }

  function updateResponse(questionId: number, response: AttemptResponse, debounce = false) {
    setAttempt((current) => {
      if (!current) return current;
      const parts = current.parts.map((part) => ({
        ...part,
        questions: part.questions.map((q) => (q.id === questionId ? { ...q, response } : q)),
      }));
      return { ...current, parts };
    });
    if (debounce) {
      clearTimeout(debounceTimers.current[questionId]);
      debounceTimers.current[questionId] = setTimeout(() => persist(questionId, response), DEBOUNCE_MS);
    } else {
      persist(questionId, response);
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
          await apiClient.post(`/student/attempts/${id}/answers/${questionId}/audio`, form);
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
    () => attempt?.parts.reduce((sum, part) => sum + part.questions.filter((q) => q.response).length, 0) ?? 0,
    [attempt],
  );
  const totalQuestions = useMemo(() => attempt?.parts.reduce((sum, part) => sum + part.questions.length, 0) ?? 0, [attempt]);

  if (error) return <p className="error-text">{error}</p>;
  if (!attempt || !currentPart) return <div className="test-runner-loading">Loading your test...</div>;

  return (
    <div className="test-runner-shell">
      <header className="test-runner-header">
        <div>
          <h1>{attempt.module_title}</h1>
          <p>{currentPart.title}{currentPart.skill_focus ? ` · ${currentPart.skill_focus}` : ""}</p>
        </div>
        <div className="test-runner-header-actions">
          {import.meta.env.DEV && isImmersiveAttempt && fullscreenActive && (
            <button type="button" className="test-runner-dev-exit" onClick={exitDeveloperFullscreen}>
              Exit full screen (dev)
            </button>
          )}
          <div className={`test-runner-timer${secondsLeft < 300 ? " is-urgent" : ""}`}>{formatTime(secondsLeft)}</div>
        </div>
      </header>

      <nav className="test-runner-parts">
        {attempt.parts.map((part, index) => (
          <button
            key={part.id}
            className={`test-runner-part-tab${index === partIndex ? " is-active" : ""}`}
            onClick={() => setPartIndex(index)}
          >
            {part.title}
            <span className="test-runner-part-progress">
              {part.questions.filter((q) => q.response).length}/{part.questions.length}
            </span>
          </button>
        ))}
      </nav>

      <main className="test-runner-body">
        {currentPart.instructions && <p className="test-runner-instructions">{currentPart.instructions}</p>}
        {currentPart.assets.map((asset) => (
          <div className="test-runner-asset" key={asset.id}>
            <p>{asset.title}</p>
            {asset.asset_type === "avatar_mp4" ? (
              <video controls src={`${API_BASE_URL}${asset.url}`} style={{ maxWidth: 480 }} />
            ) : (
              <audio controls src={`${API_BASE_URL}${asset.url}`} />
            )}
          </div>
        ))}
        {currentPart.questions.map((question, qIndex) => (
          <QuestionInput
            key={question.id}
            index={qIndex + 1}
            question={question}
            saving={savingIds.has(question.id)}
            recording={recordingQuestionId === question.id}
            onChange={(response, debounce) => updateResponse(question.id, response, debounce)}
            onRecord={() => recordSpeakingAnswer(question.id)}
          />
        ))}
      </main>

      <footer className="test-runner-footer">
        <span>{answeredCount} of {totalQuestions} answered</span>
        <div>
          <button className="secondary-button" disabled={partIndex === 0} onClick={() => setPartIndex((i) => i - 1)}>← Previous part</button>
          {partIndex < attempt.parts.length - 1 ? (
            <button onClick={() => setPartIndex((i) => i + 1)}>Next part →</button>
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
      {question.passage && <p className="test-runner-passage">{question.passage}</p>}
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
