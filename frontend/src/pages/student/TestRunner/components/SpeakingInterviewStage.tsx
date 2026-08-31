import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "@/api/client";
import type { Attempt } from "@/api/types";
import { Icon } from "@/components/icons";
import { SpeakingAvatar } from "@/components/speaking/SpeakingAvatar";
import { Button, RichTextContent } from "@/components/ui";
import { hasAttemptResponse } from "@/pages/student/attemptMetrics";
import { unlockSharedAudioContext } from "@/lib/talking-avatar.js";
import { testRunnerStrings as strings } from "../TestRunner.strings";
import { formatTime } from "../helpers";
import { useAuthStore } from "@/store/authStore";
import "./SpeakingInterviewStage.css";

/* `starting` is the microphone spinning up between preparation and recording.
   It used to be spent in `preparing`, which left the panel reading
   "Preparation time 0:00" while the candidate waited - preparation shown at a
   moment when preparation was already over. */
type InterviewMode = "ready" | "preparing" | "starting" | "recording" | "uploading" | "complete";

/** Whole seconds left until a deadline, floored at zero. */
function secondsUntil(deadline: number): number {
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}

const VOICE_DOT_COUNT = 160;
const VOICE_DOT_SAMPLE_INTERVAL_MS = 38;

function VoiceActivityDots({ active, stream }: { active: boolean; stream: MediaStream | null }) {
  const dotsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const dots = dotsRef.current;
    if (!dots || !active || !stream || stream.getAudioTracks().every((track) => track.readyState !== "live")) {
      return undefined;
    }

    const AudioContextConstructor = window.AudioContext
      ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return undefined;

    const context = new AudioContextConstructor();
    const analyser = context.createAnalyser();
    const source = context.createMediaStreamSource(stream);
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.58;
    const samples = new Uint8Array(analyser.fftSize);
    const recentLevels = Array.from({ length: VOICE_DOT_COUNT }, () => 0);
    let animationFrame = 0;
    let lastLevelSample = 0;
    source.connect(analyser);
    void context.resume().catch(() => {});

    const updateDots = (timestamp = 0) => {
      analyser.getByteTimeDomainData(samples);
      let sumOfSquares = 0;
      for (const sample of samples) {
        const centred = (sample - 128) / 128;
        sumOfSquares += centred * centred;
      }
      const rms = Math.sqrt(sumOfSquares / samples.length);
      /* Browser echo/noise suppression can leave ordinary speech with a very
         small RMS value. A low floor plus a curved gain makes quiet speech
         visibly rise and fall while still keeping silence close to a dotted
         baseline. */
      const speechEnergy = Math.max(0, rms - 0.003);
      const inputLevel = Math.min(1, Math.pow(speechEnergy * 46, 0.72));

      /* WhatsApp-style recording waveform: the newest microphone level is
         drawn at the right edge; older samples travel left until they leave
         the lane. */
      if (timestamp - lastLevelSample >= VOICE_DOT_SAMPLE_INTERVAL_MS) {
        recentLevels.shift();
        recentLevels.push(inputLevel);
        lastLevelSample = timestamp;

        const dotElements = dots.children;
        for (let index = 0; index < dotElements.length; index += 1) {
          const level = recentLevels[index];
          const height = 4 + Math.min(46, level * 52);
          const opacity = 0.44 + Math.min(0.56, level * 0.56);
          (dotElements[index] as HTMLElement).style.height = `${height.toFixed(1)}px`;
          (dotElements[index] as HTMLElement).style.opacity = opacity.toFixed(2);
        }
      }
      animationFrame = window.requestAnimationFrame(updateDots);
    };
    updateDots();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      source.disconnect();
      void context.close().catch(() => {});
      Array.from(dots.children).forEach((dot) => {
        (dot as HTMLElement).style.removeProperty("height");
        (dot as HTMLElement).style.removeProperty("opacity");
      });
    };
  }, [active, stream]);

  return (
    <div
      ref={dotsRef}
      className={`speaking-voice-dots${active ? " is-active" : ""}`}
      role="img"
      aria-label={active ? "Live microphone input level" : "Microphone input"}
    >
      {Array.from({ length: VOICE_DOT_COUNT }, (_, index) => (
        <span key={index} />
      ))}
    </div>
  );
}

interface SpeakingInterviewStageProps {
  attemptId: number;
  moduleTitle: string;
  currentPart: Attempt["parts"][number];
  speakingPartNumber: number;
  speakingPartCount: number;
  isLastTestPart: boolean;
  secondsLeft: number;
  languageCertSkin?: boolean;
  savingIds: Set<number>;
  audioInputStream: MediaStream | null;
  recordingQuestionId: number | null;
  recordingFailedQuestionId: number | null;
  /** Persistent, non-toast explanation for the current `recordingFailedQuestionId` -
      stays on screen next to the record button instead of fading like the toast. */
  recordingErrorMessage: string | null;
  onRecord: (questionId: number) => Promise<boolean>;
  onContinuePart: () => void;
}

export function SpeakingInterviewStage({
  attemptId,
  moduleTitle,
  currentPart,
  speakingPartNumber,
  speakingPartCount,
  isLastTestPart,
  secondsLeft,
  languageCertSkin = false,
  savingIds,
  audioInputStream,
  recordingQuestionId,
  recordingFailedQuestionId,
  recordingErrorMessage,
  onRecord,
  onContinuePart,
}: SpeakingInterviewStageProps) {
  const firstOpenQuestion = useMemo(() => {
    const index = currentPart.questions.findIndex((question) => !hasAttemptResponse(question));
    if (index >= 0) return index;
    // Every prompt in this part is answered, so stay on the last one and let the
    // part hand over to the next. Returning 0 here sent the interview back to
    // the first prompt the instant the final answer saved: the examiner re-asked
    // question one and the part never completed.
    return Math.max(currentPart.questions.length - 1, 0);
  }, [currentPart.questions]);
  const [questionIndex, setQuestionIndex] = useState(firstOpenQuestion);
  const question = currentPart.questions[questionIndex];
  const recorded = Boolean(question?.response?.recorded);
  const [mode, setMode] = useState<InterviewMode>(recorded ? "complete" : "ready");
  const [preparationLeft, setPreparationLeft] = useState(0);
  const [responseLeft, setResponseLeft] = useState(0);
  const notesStorageKey = `speaking-notes:${attemptId}:${question?.id ?? "none"}`;
  const [notes, setNotesState] = useState("");
  const setNotes = useCallback((value: string) => {
    setNotesState(value);
    // Kept in session storage so a refresh or a dropped connection mid-
    // preparation does not wipe what the candidate planned to say.
    try {
      sessionStorage.setItem(notesStorageKey, value);
    } catch {
      // Storage can be unavailable in private browsing - notes are a
      // convenience, never worth breaking the exam over.
    }
  }, [notesStorageKey]);
  const startingRef = useRef(false);
  /* Both countdowns run off a deadline rather than by subtracting one from the
     display every second. A chain of timeouts drifts - and stalls outright
     while the tab is backgrounded - so preparation would quietly run longer
     than the allowance it is showing, and the response clock longer still. */
  const preparationDeadlineRef = useRef<number>(0);
  const responseDeadlineRef = useRef<number>(0);
  const onContinuePartRef = useRef(onContinuePart);
  const previousQuestionIdRef = useRef<number | null>(question?.id ?? null);
  const t = strings.speakingInterview;
  // Each prompt carries its own timing; the part has none to fall back on and
  // nothing here invents one. Zero preparation means exactly that - recording
  // starts as the examiner finishes, with no countdown and no button to press.
  const preparationSeconds = question?.interaction?.preparation_seconds ?? 0;
  const responseSeconds = question?.interaction?.response_seconds ?? 0;
  // Examiner audio is the cue for every prompt, including prompts with a
  // preparation allowance. If that cue never arrives because playback failed,
  // a delayed recovery control appears rather than leaving the candidate stuck.
  const [manualStartOffered, setManualStartOffered] = useState(false);
  // A prompt can be spoken in two pieces with a pause between them, so silence
  // on its own is not evidence that the audio failed. The rescue only counts
  // while the examiner is neither speaking nor mid-pause.
  const [examinerBusy, setExaminerBusy] = useState(false);
  const isLastQuestion = questionIndex >= currentPart.questions.length - 1;
  /* Every hook in this component has to run above the `!question` return
     below. A part switch renders once with the previous part's questionIndex
     still in state - the reset effect has not run yet - so `question` is
     briefly undefined whenever the next part is shorter or its questions are
     still being fetched. A hook called after that return would then be skipped
     on exactly that render, and React tears the whole exam down with
     "rendered fewer hooks than expected". */
  const user = useAuthStore((state) => state.user);
  const showSkip = user?.email?.toLowerCase() === "tarund4355@gmail.com";

  useEffect(() => {
    onContinuePartRef.current = onContinuePart;
  }, [onContinuePart]);

  useEffect(() => {
    setQuestionIndex(firstOpenQuestion);
  }, [currentPart.id, firstOpenQuestion]);

  useEffect(() => {
    if (previousQuestionIdRef.current !== (question?.id ?? null)) {
      previousQuestionIdRef.current = question?.id ?? null;
      setMode(recorded ? "complete" : "ready");
      setPreparationLeft(0);
      setResponseLeft(0);
      setNotesState(sessionStorage.getItem(`speaking-notes:${attemptId}:${question?.id ?? "none"}`) ?? "");
      startingRef.current = false;
    }
  }, [attemptId, question?.id, recorded]);

  useEffect(() => {
    if (mode !== "ready") {
      setManualStartOffered(false);
      return undefined;
    }
    if (examinerBusy) return undefined;
    const rescue = window.setTimeout(() => setManualStartOffered(true), 12000);
    return () => window.clearTimeout(rescue);
  }, [mode, question?.id, examinerBusy]);

  useEffect(() => {
    if (mode !== "preparing") return undefined;
    const tick = () => setPreparationLeft(secondsUntil(preparationDeadlineRef.current));
    tick();
    const timer = window.setInterval(tick, 200);
    return () => window.clearInterval(timer);
  }, [mode]);

  const startRecording = useCallback(() => {
    if (!question || startingRef.current) return;
    startingRef.current = true;
    setMode("starting");
    void onRecord(question.id).then((started) => {
      startingRef.current = false;
      if (started) {
        // The response allowance starts when the recorder does, never when the
        // prompt was drawn: the microphone can take a moment to open.
        responseDeadlineRef.current = Date.now() + responseSeconds * 1000;
        setResponseLeft(responseSeconds);
        setMode("recording");
      } else {
        setMode("ready");
      }
    });
  }, [onRecord, question, responseSeconds]);

  useEffect(() => {
    if (mode !== "preparing" || preparationLeft !== 0) return;
    startRecording();
  }, [mode, preparationLeft, startRecording]);

  useEffect(() => {
    if (mode !== "recording") return undefined;
    const tick = () => setResponseLeft(secondsUntil(responseDeadlineRef.current));
    tick();
    const timer = window.setInterval(tick, 200);
    return () => window.clearInterval(timer);
  }, [mode]);

  useEffect(() => {
    if (mode !== "recording" || responseLeft !== 0 || !question) return;
    setMode("uploading");
    void onRecord(question.id);
  }, [mode, onRecord, question, responseLeft]);

  useEffect(() => {
    if (mode === "uploading" && recorded && question && !savingIds.has(question.id)) {
      setMode("complete");
    }
  }, [mode, question, recorded, savingIds]);

  useEffect(() => {
    if (question && recordingFailedQuestionId === question.id) setMode("ready");
  }, [question, recordingFailedQuestionId]);

  useEffect(() => {
    if (mode === "complete") {
      const timer = setTimeout(() => {
        if (!isLastQuestion) {
          setQuestionIndex((index) => index + 1);
        } else {
          onContinuePartRef.current();
        }
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [isLastQuestion, mode]);

  if (!question) return null;

  const beginPreparation = () => {
    try {
      const audio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAAA");
      audio.play().catch(() => {});
      unlockSharedAudioContext();
    } catch (e) {
      console.warn("Audio unlock failed:", e);
    }
    // Only ever start from a standing start. The examiner avatar calls this on
    // audio end, and the Start button calls it too - without this guard, a
    // candidate who pressed Start while the examiner was still speaking was
    // thrown out of `recording` and back into `preparing` a moment later, losing
    // the answer they had already begun.
    if (mode !== "ready") return;
    if (preparationSeconds <= 0) {
      setPreparationLeft(0);
      startRecording();
      return;
    }
    preparationDeadlineRef.current = Date.now() + preparationSeconds * 1000;
    setPreparationLeft(preparationSeconds);
    setMode("preparing");
  };

  const submitResponse = () => {
    if (mode !== "recording") return;
    setMode("uploading");
    void onRecord(question.id);
  };

  const continueInterview = () => {
    if (!isLastQuestion) {
      setQuestionIndex((index) => index + 1);
      return;
    }
    onContinuePart();
  };

  const hasCandidateText = Boolean(question.passage?.trim());
  const candidatePdfUrl = question.interaction?.candidate_material_url
    ? `${API_BASE_URL}${question.interaction.candidate_material_url}`
    : null;
  const candidateImageUrl = question.image_url ? `${API_BASE_URL}${question.image_url}` : null;
  const hasCandidateAttachment = Boolean(candidateImageUrl || candidatePdfUrl);
  const recordingFailedForQuestion = recordingFailedQuestionId === question.id && Boolean(recordingErrorMessage);
  const canStartManually = mode === "ready" && (manualStartOffered || showSkip);
  const isSubmittingAnswer = mode === "uploading" || (mode === "complete" && isLastQuestion && isLastTestPart);
  /* Silence is not evidence the examiner audio is still on its way - it is
     indistinguishable, to the candidate, from playback having quietly failed.
     The rescue timer above only counts down through this same window, so the
     label switches to a waiting indicator for exactly as long as that timer
     is running, rather than sitting on a static "Playing Question..." with
     nothing on screen to show anything is happening. */
  const isWaitingSilently = mode === "ready" && !examinerBusy && !manualStartOffered;
  const dockStatusLabel = mode === "ready"
    ? (isWaitingSilently ? t.waitingForExaminerAudio : t.playingQuestion)
    : mode === "preparing"
      ? t.preparingNow(preparationLeft)
      : mode === "starting"
        ? t.startingRecording
        : mode === "recording"
          ? t.recordingNow
          : mode === "uploading"
            ? t.saving
            : mode === "complete"
              ? t.saved
              : t.playingQuestion;
  const materialClassName = [
    "speaking-candidate-material",
    hasCandidateText ? "has-text" : "",
    hasCandidateAttachment ? "has-attachment" : "",
  ].filter(Boolean).join(" ");
  const timerValue = mode === "preparing" ? preparationLeft : mode === "recording" ? responseLeft : responseSeconds;
  const timerLabel = mode === "preparing" ? t.preparation : mode === "recording" ? t.recording : t.responseLimit;

  if (languageCertSkin) {
    return (
      <div className="speaking-interview-stage speaking-interview-stage--lc">
      <div className="speaking-interview-layout">
        <section className="speaking-interview-workspace">
          <div className="speaking-interview-progress">
            <span>{t.partProgress(speakingPartNumber, speakingPartCount)}</span>
            <span>{question.interaction?.turn_type?.replaceAll("_", " ") || t.questionProgress(questionIndex + 1, currentPart.questions.length)}</span>
          </div>

          <div className={materialClassName}>
            {hasCandidateText && question.passage ? (
              <article className="speaking-interview-passage">
                <RichTextContent text={question.passage} />
              </article>
            ) : null}
            {candidateImageUrl ? (
              <figure className="speaking-candidate-attachment">
                <img src={candidateImageUrl} alt="Speaking task material" />
              </figure>
            ) : candidatePdfUrl ? (
              <div className="speaking-candidate-attachment">
                <object data={candidatePdfUrl} type="application/pdf" aria-label="Speaking task PDF">
                  <a href={candidatePdfUrl} target="_blank" rel="noreferrer">Open the speaking task PDF</a>
                </object>
              </div>
            ) : null}
          </div>

          {currentPart.answer_constraints.notes_allowed && (
            <label className="speaking-interview-notes">
              <span>Preparation notes</span>
              {/* Stay visible while recording: these notes exist to be spoken
                  from, and hiding them at the moment the candidate starts
                  presenting defeats the point of the preparation minute. */}
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                readOnly={mode === "recording" || mode === "uploading"}
                rows={4}
                maxLength={1200}
                placeholder="Notes are available in Speaking Part 4 only."
              />
            </label>
          )}

          {mode === "preparing" ? (
            <div className="speaking-interview-control-dock is-prep">
              <div className="speaking-prep-timer" aria-label={`${t.preparation} ${formatTime(preparationLeft)}`}>
                <strong>{formatTime(preparationLeft)}</strong>
                <span>READING PREP</span>
              </div>
              <div className="speaking-prep-status">
                {t.recordingStartsAutomatically}
                {showSkip && (
                  <Button
                    type="button"
                    variant="danger"
                    onClick={startRecording}
                    style={{
                      marginLeft: "12px",
                      padding: "4px 8px",
                      fontSize: "11px",
                    }}
                  >
                    Skip Prep
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="speaking-interview-control-dock">
              <div className="speaking-waveform-lane">
                <VoiceActivityDots active={mode === "recording"} stream={audioInputStream} />
              </div>

              <div className="speaking-interview-actions">
                <Button className="speaking-control-button is-status" disabled leftIcon={<span className="speaking-status-spinner" aria-hidden="true" />}>
                  {dockStatusLabel}
                </Button>
                <Button
                  className="speaking-control-button"
                  disabled={!canStartManually}
                  leftIcon={<Icon name="microphone" />}
                  onClick={beginPreparation}
                >
                  {t.recordAnswer}
                </Button>
                <Button
                  className="speaking-control-button"
                  disabled={mode !== "recording" || recordingQuestionId !== question.id}
                  loading={isSubmittingAnswer}
                  onClick={submitResponse}
                >
                  {t.submitAnswer}
                </Button>
                {mode === "complete" && !(isLastQuestion && isLastTestPart) ? (
                  <Button className="speaking-control-button is-next" rightIcon={<Icon name="arrowRight" />} onClick={continueInterview}>
                    {isLastQuestion ? t.continueToNextPart : t.continueToNextQuestion}
                  </Button>
                ) : null}
              </div>

              {recordingFailedForQuestion && (
                <div className="speaking-mic-error-card" role="alert">
                  <Icon name="cross" />
                  <span>{recordingErrorMessage}</span>
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="speaking-interview-examiner">
          <div className="speaking-interview-avatar">
            <SpeakingAvatar
              key={`${currentPart.id}:${question.id}`}
              attemptId={attemptId}
              avatarOnly
              isCandidateRecording={mode === "recording"}
              partId={currentPart.id}
              questionId={question.id}
              onAudioEnded={beginPreparation}
              onExaminerBusyChange={setExaminerBusy}
            />
          </div>
          <div className="speaking-interview-examiner-copy">
            <strong>Instructor</strong>
            <span>{mode === "recording" ? "Listening to your response" : "Speaking examiner"}</span>
          </div>
        </aside>
      </div>
    </div>
  );
  }

  return (
    <main className="speaking-interview-stage speaking-interview-stage--classic">
      <header className="speaking-interview-header">
        <div>
          <span>Speaking interview</span>
          <strong>{moduleTitle}</strong>
        </div>
        <div className="speaking-interview-overall-time" role="timer" aria-live="polite">
          <span>{t.testTime}</span>
          <strong>{formatTime(secondsLeft)}</strong>
        </div>
      </header>

      <div className="speaking-interview-layout">
        <aside className="speaking-interview-parts" aria-label="Speaking parts">
          <span className="speaking-interview-parts-label">Parts</span>
          {Array.from({ length: speakingPartCount }, (_, index) => {
            const partNumber = index + 1;
            const stateClass = partNumber < speakingPartNumber
              ? "is-complete"
              : partNumber === speakingPartNumber
                ? "is-current"
                : "";
            return (
              <div key={partNumber} className={`speaking-interview-part ${stateClass}`.trim()}>
                <span>{partNumber}</span>
                <strong>Part {partNumber}</strong>
              </div>
            );
          })}
        </aside>

        <section className="speaking-interview-workspace">
          <div className="speaking-interview-progress">
            <span>{t.partProgress(speakingPartNumber, speakingPartCount)}</span>
            <span>{question.interaction?.turn_type?.replaceAll("_", " ") || t.questionProgress(questionIndex + 1, currentPart.questions.length)}</span>
          </div>

          <div className={materialClassName}>
            {hasCandidateText && question.passage ? (
              <article className="speaking-interview-passage">
                <RichTextContent text={question.passage} />
              </article>
            ) : null}
            {candidateImageUrl ? (
              <figure className="speaking-candidate-attachment">
                <img src={candidateImageUrl} alt="Speaking task material" />
              </figure>
            ) : candidatePdfUrl ? (
              <div className="speaking-candidate-attachment">
                <object data={candidatePdfUrl} type="application/pdf" aria-label="Speaking task PDF">
                  <a href={candidatePdfUrl} target="_blank" rel="noreferrer">Open the speaking task PDF</a>
                </object>
              </div>
            ) : !hasCandidateText ? (
              <div className="speaking-candidate-empty">
                <Icon name="microphone" />
                <strong>Listen to Instructor</strong>
                <span>The examiner will give the instructions and ask the question aloud.</span>
              </div>
            ) : null}
          </div>

          {currentPart.answer_constraints.notes_allowed && (
            <label className="speaking-interview-notes">
              <span>Preparation notes</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                readOnly={mode === "recording" || mode === "uploading"}
                rows={4}
                maxLength={1200}
                placeholder="Notes are available in Speaking Part 4 only."
              />
            </label>
          )}

          <div className="speaking-interview-control-dock">
            <div className={`speaking-interview-timer is-${mode}`}>
              <span>{timerLabel}</span>
              <strong>{formatTime(timerValue)}</strong>
              <small>
                {mode === "ready"
                  ? manualStartOffered ? (
                    "Examiner audio did not finish. You can start manually."
                  ) : isWaitingSilently ? (
                    <span className="speaking-waiting-indicator">
                      <span className="speaking-status-spinner" aria-hidden="true" />
                      {t.waitingForExaminerAudio}
                    </span>
                  ) : t.playingQuestion
                : mode === "preparing"
                    ? (
                      <>
                        {t.recordingStartsAutomatically}
                        {showSkip && (
                          <Button
                            type="button"
                            variant="danger"
                            onClick={startRecording}
                            style={{
                              marginLeft: "12px",
                              padding: "4px 8px",
                              fontSize: "11px",
                            }}
                          >
                            Skip Prep
                          </Button>
                        )}
                      </>
                    )
                    : mode === "starting"
                      ? t.startingRecording
                      : mode === "recording"
                        ? t.recordingNow
                        : mode === "uploading"
                          ? t.savingResponse
                          : t.saved}
              </small>
            </div>

            <div className="speaking-interview-classic-waveform">
              <VoiceActivityDots active={mode === "recording"} stream={audioInputStream} />
            </div>

            <div className="speaking-interview-actions">
              <Button
                variant="secondary"
                size="lg"
                disabled={!canStartManually}
                leftIcon={<Icon name="microphone" />}
                onClick={beginPreparation}
              >
                {manualStartOffered ? t.startResponse : t.playingQuestion}
              </Button>
              <Button
                variant="primary"
                size="lg"
                disabled={mode !== "recording" || recordingQuestionId !== question.id}
                loading={isSubmittingAnswer}
                onClick={submitResponse}
              >
                {t.submitResponse}
              </Button>
              {mode === "complete" && !(isLastQuestion && isLastTestPart) ? (
                <Button variant="primary" size="lg" rightIcon={<Icon name="arrowRight" />} onClick={continueInterview}>
                  {isLastQuestion ? t.continueToNextPart : t.continueToNextQuestion}
                </Button>
              ) : null}
            </div>

            {recordingFailedForQuestion && (
              <div className="speaking-mic-error-card" role="alert">
                <Icon name="cross" />
                <span>{recordingErrorMessage}</span>
              </div>
            )}
          </div>
        </section>

        <aside className="speaking-interview-examiner">
          <div className="speaking-interview-avatar">
            <SpeakingAvatar
              key={`${currentPart.id}:${question.id}`}
              attemptId={attemptId}
              avatarOnly
              isCandidateRecording={mode === "recording"}
              partId={currentPart.id}
              questionId={question.id}
              onAudioEnded={beginPreparation}
              onExaminerBusyChange={setExaminerBusy}
            />
          </div>
          <div className="speaking-interview-examiner-copy">
            <strong>Instructor</strong>
            <span>{mode === "recording" ? "Listening to your response" : "Speaking examiner"}</span>
          </div>
        </aside>
      </div>
    </main>
  );
}
