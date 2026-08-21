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
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.72;
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
      /* Normal laptop microphones often report speech around 0.02-0.05 RMS.
         Use a small noise floor and a stronger gain so ordinary speech is
         visibly different from silence without clipping louder answers. */
      const inputLevel = Math.min(1, Math.max(0, (rms - 0.008) * 24));

      /* New microphone levels enter on the left and move across the row. A
         natural decay keeps the right side as the dotted tail shown in the
         reference instead of turning the whole indicator into equal bars. */
      if (timestamp - lastLevelSample >= 45) {
        recentLevels.pop();
        recentLevels.unshift(inputLevel);
        lastLevelSample = timestamp;

        const dotElements = dots.children;
        for (let index = 0; index < dotElements.length; index += 1) {
          const tailDecay = Math.exp(-index / 34);
          const height = 3 + Math.min(29, recentLevels[index] * 30 * tailDecay);
          (dotElements[index] as HTMLElement).style.height = `${height.toFixed(1)}px`;
        }
      }
      animationFrame = window.requestAnimationFrame(updateDots);
    };
    updateDots();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      source.disconnect();
      void context.close().catch(() => {});
      Array.from(dots.children).forEach((dot) => (dot as HTMLElement).style.removeProperty("height"));
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
  currentPart: Attempt["parts"][number];
  speakingPartNumber: number;
  speakingPartCount: number;
  isLastTestPart: boolean;
  savingIds: Set<number>;
  audioInputStream: MediaStream | null;
  recordingQuestionId: number | null;
  recordingFailedQuestionId: number | null;
  onRecord: (questionId: number) => Promise<boolean>;
  onContinuePart: () => void;
}

export function SpeakingInterviewStage({
  attemptId,
  currentPart,
  speakingPartNumber,
  speakingPartCount,
  isLastTestPart,
  savingIds,
  audioInputStream,
  recordingQuestionId,
  recordingFailedQuestionId,
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
  const hasPreparation = preparationSeconds > 0;
  // Examiner audio is the cue for every prompt, including prompts with a
  // preparation allowance. If that cue never arrives because playback failed,
  // a delayed recovery control appears rather than leaving the candidate stuck.
  const [manualStartOffered, setManualStartOffered] = useState(false);
  // A prompt can be spoken in two pieces with a pause between them, so silence
  // on its own is not evidence that the audio failed. The rescue only counts
  // while the examiner is neither speaking nor mid-pause.
  const [examinerBusy, setExaminerBusy] = useState(false);
  // Drives the audio progress bar in the control dock - 0-1 through whichever
  // clip the examiner is currently playing.
  const [examinerProgress, setExaminerProgress] = useState(0);
  const isLastQuestion = questionIndex >= currentPart.questions.length - 1;

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
      setExaminerProgress(0);
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

  /* One clock per mode, chosen explicitly. Preparation counts the preparation
     allowance and nothing else; recording counts the response allowance and
     nothing else; before either starts the panel shows whichever of the two
     comes next for this prompt. */
  const timer = (() => {
    switch (mode) {
      case "preparing":
        return { label: t.preparation, value: preparationLeft };
      case "recording":
        return { label: t.recording, value: responseLeft };
      case "starting":
        return { label: t.responseLimit, value: responseSeconds };
      case "ready":
        return hasPreparation
          ? { label: t.preparation, value: preparationSeconds }
          : { label: t.responseLimit, value: responseSeconds };
      default:
        return { label: t.responseLimit, value: responseSeconds };
    }
  })();
  const hasCandidateText = Boolean(question.passage?.trim());
  const candidatePdfUrl = question.interaction?.candidate_material_url
    ? `${API_BASE_URL}${question.interaction.candidate_material_url}`
    : null;
  const candidateImageUrl = question.image_url ? `${API_BASE_URL}${question.image_url}` : null;
  const hasCandidateAttachment = Boolean(candidateImageUrl || candidatePdfUrl);
  const materialClassName = [
    "speaking-candidate-material",
    hasCandidateText ? "has-text" : "",
    hasCandidateAttachment ? "has-attachment" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className="speaking-interview-stage">
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

          <div className="speaking-interview-audio-progress" aria-hidden="true">
            <div
              className="speaking-interview-audio-progress-fill"
              style={{ width: `${Math.round((mode === "ready" && examinerBusy ? examinerProgress : mode === "ready" ? 0 : 1) * 100)}%` }}
            />
          </div>

          <div className="speaking-interview-control-dock">
            <div className={`speaking-interview-timer is-${mode}`}>
              <span>{timer.label}</span>
              <strong>{formatTime(timer.value)}</strong>
              <div className="speaking-interview-status">
                <small>
                  {mode === "ready" && examinerBusy
                    ? t.playingQuestion
                    : mode === "preparing"
                    ? t.recordingStartsAutomatically
                    : mode === "starting"
                      ? t.startingRecording
                      : mode === "recording"
                        ? t.recordingNow
                        : mode === "uploading"
                          ? t.saving
                          : mode === "complete"
                            ? t.saved
                            : hasPreparation
                              ? t.ready(preparationSeconds)
                              : "Recording starts when the examiner finishes"}
                </small>
                {mode === "recording" && (
                  <VoiceActivityDots active stream={audioInputStream} />
                )}
              </div>
            </div>

            <div className="speaking-interview-actions">
              {mode === "ready" && manualStartOffered && (
                <Button leftIcon={<Icon name="play" />} onClick={beginPreparation} size="lg">{t.startResponse}</Button>
              )}
              {/* Preparation is an allowance, not an offer: the candidate gets
                  all of it and recording begins on its own when it runs out.
                  The button stays on screen, disabled, so the wait reads as
                  part of the exam rather than a page that stopped responding. */}
              {(mode === "preparing" || mode === "starting") && (
                <Button leftIcon={<Icon name="microphone" />} size="lg" disabled>
                  {mode === "starting" ? t.startingRecording : t.preparingNow(preparationLeft)}
                </Button>
              )}
              {mode === "recording" && recordingQuestionId === question.id && <Button leftIcon={<Icon name="check" />} onClick={submitResponse} size="lg">{t.submitResponse}</Button>}
              {mode === "uploading" && <Button disabled loading size="lg">{t.savingResponse}</Button>}
              {/* The last prompt of the last part ends the test: the stage
                  submits it a moment later on its own, so this reports what is
                  happening instead of offering a button that would race it. */}
              {mode === "complete" && (isLastQuestion && isLastTestPart ? (
                <Button disabled loading size="lg">{t.submittingTest}</Button>
              ) : (
                <Button rightIcon={<Icon name="arrowRight" />} onClick={continueInterview} size="lg">
                  {isLastQuestion ? t.continueToNextPart : t.continueToNextQuestion}
                </Button>
              ))}
            </div>
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
              onAudioProgress={setExaminerProgress}
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
