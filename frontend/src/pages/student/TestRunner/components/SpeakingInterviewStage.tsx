import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "@/api/client";
import type { Attempt } from "@/api/types";
import { Icon } from "@/components/icons";
import { SpeakingAvatar } from "@/components/speaking/SpeakingAvatar";
import { Button } from "@/components/ui";
import { hasAttemptResponse } from "@/pages/student/attemptMetrics";
import { testRunnerStrings as strings } from "../TestRunner.strings";
import { formatTime } from "../helpers";
import "./SpeakingInterviewStage.css";

type InterviewMode = "ready" | "preparing" | "recording" | "uploading" | "complete";

interface SpeakingInterviewStageProps {
  attemptId: number;
  moduleTitle: string;
  currentPart: Attempt["parts"][number];
  speakingPartNumber: number;
  speakingPartCount: number;
  isLastTestPart: boolean;
  secondsLeft: number;
  savingIds: Set<number>;
  recordingQuestionId: number | null;
  recordingFailedQuestionId: number | null;
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
  savingIds,
  recordingQuestionId,
  recordingFailedQuestionId,
  onRecord,
  onContinuePart,
}: SpeakingInterviewStageProps) {
  const firstOpenQuestion = useMemo(() => {
    const index = currentPart.questions.findIndex((question) => !hasAttemptResponse(question));
    return index >= 0 ? index : 0;
  }, [currentPart.questions]);
  const [questionIndex, setQuestionIndex] = useState(firstOpenQuestion);
  const question = currentPart.questions[questionIndex];
  const recorded = Boolean(question?.response?.recorded);
  const [mode, setMode] = useState<InterviewMode>(recorded ? "complete" : "ready");
  const [preparationLeft, setPreparationLeft] = useState(0);
  const [responseLeft, setResponseLeft] = useState(0);
  const [notes, setNotes] = useState("");
  const startingRef = useRef(false);
  const onContinuePartRef = useRef(onContinuePart);
  const previousQuestionIdRef = useRef<number | null>(question?.id ?? null);
  const t = strings.speakingInterview;
  const preparationSeconds = question?.interaction?.preparation_seconds
    ?? currentPart.answer_constraints.preparation_seconds
    ?? 5;
  const responseSeconds = question?.interaction?.response_seconds
    ?? currentPart.answer_constraints.response_seconds
    ?? 60;
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
      setNotes("");
      startingRef.current = false;
    }
  }, [question?.id, recorded]);

  useEffect(() => {
    if (mode !== "preparing" || preparationLeft <= 0) return undefined;
    const timer = window.setTimeout(() => setPreparationLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [mode, preparationLeft]);

  const startRecording = useCallback(() => {
    if (!question || startingRef.current) return;
    startingRef.current = true;
    setMode("preparing");
    void onRecord(question.id).then((started) => {
      startingRef.current = false;
      if (started) {
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
    if (mode !== "recording" || responseLeft <= 0) return undefined;
    const timer = window.setTimeout(() => setResponseLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [mode, responseLeft]);

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
    if (preparationSeconds <= 0) {
      setPreparationLeft(0);
      startRecording();
      return;
    }
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

  const timerValue = mode === "preparing" ? preparationLeft : mode === "recording" ? responseLeft : responseSeconds;
  const timerLabel = mode === "preparing" ? t.preparation : mode === "recording" ? t.recording : t.responseLimit;
  const materialType = question.interaction?.candidate_material_type
    ?? (question.image_url ? "image" : question.passage ? "text" : "none");
  const candidatePdfUrl = question.interaction?.candidate_material_url
    ? `${API_BASE_URL}${question.interaction.candidate_material_url}`
    : null;
  const candidateImageUrl = question.image_url ? `${API_BASE_URL}${question.image_url}` : null;

  return (
    <main className="speaking-interview-stage">
      <header className="speaking-interview-header">
        <div>
          <span>{moduleTitle}</span>
          <strong>{currentPart.title}</strong>
        </div>
        <div className="speaking-interview-overall-time">
          <span>{t.testTime}</span>
          <strong>{formatTime(secondsLeft)}</strong>
        </div>
      </header>

      <section className="speaking-interview-layout">
        <aside className="speaking-interview-parts" aria-label="Speaking test parts">
          <span className="speaking-interview-parts-label">Speaking</span>
          {Array.from({ length: speakingPartCount }, (_, index) => {
            const partNumber = index + 1;
            const state = partNumber < speakingPartNumber ? "complete" : partNumber === speakingPartNumber ? "current" : "upcoming";
            return (
              <div className={`speaking-interview-part is-${state}`} key={partNumber} aria-current={state === "current" ? "step" : undefined}>
                <span>{partNumber < speakingPartNumber ? "✓" : partNumber}</span>
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

          <div className={`speaking-candidate-material is-${materialType}`}>
            {materialType === "text" && question.passage ? (
              <article className="speaking-interview-passage">{question.passage}</article>
            ) : materialType === "image" && candidateImageUrl ? (
              <img src={candidateImageUrl} alt="Speaking task material" />
            ) : materialType === "pdf" && candidatePdfUrl ? (
              <object data={candidatePdfUrl} type="application/pdf" aria-label="Speaking task PDF">
                <a href={candidatePdfUrl} target="_blank" rel="noreferrer">Open the speaking task PDF</a>
              </object>
            ) : (
              <div className="speaking-candidate-empty">
                <Icon name="microphone" />
                <strong>Listen to Sonia</strong>
                <span>The examiner will give the instructions and ask the question aloud.</span>
              </div>
            )}
          </div>

          {currentPart.answer_constraints.notes_allowed && mode !== "recording" && mode !== "uploading" && (
            <label className="speaking-interview-notes">
              <span>Preparation notes</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
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
                {mode === "preparing"
                  ? t.recordingStartsAutomatically
                  : mode === "recording"
                    ? t.recordingNow
                    : mode === "uploading"
                      ? t.saving
                      : mode === "complete"
                        ? t.saved
                        : t.ready(preparationSeconds)}
              </small>
            </div>

            <div className="speaking-interview-actions">
              {mode === "ready" && <Button leftIcon={<Icon name="play" />} onClick={beginPreparation} size="lg">{t.startResponse}</Button>}
              {mode === "preparing" && <Button disabled size="lg" variant="secondary">{t.getReady}</Button>}
              {mode === "recording" && recordingQuestionId === question.id && <Button leftIcon={<Icon name="check" />} onClick={submitResponse} size="lg">{t.submitResponse}</Button>}
              {mode === "uploading" && <Button disabled loading size="lg">{t.savingResponse}</Button>}
              {mode === "complete" && (
                <Button rightIcon={<Icon name="arrowRight" />} onClick={continueInterview} size="lg">
                  {isLastQuestion ? isLastTestPart ? t.reviewAndSubmit : t.continueToNextPart : t.continueToNextQuestion}
                </Button>
              )}
            </div>
          </div>
        </section>

        <aside className="speaking-interview-examiner">
          <div className="speaking-interview-avatar">
            <SpeakingAvatar
              attemptId={attemptId}
              avatarOnly
              isCandidateRecording={mode === "recording"}
              partId={currentPart.id}
              questionId={question.id}
              onAudioEnded={beginPreparation}
            />
          </div>
          <div className="speaking-interview-examiner-copy">
            <strong>Sonia Radcliffe</strong>
            <span>{mode === "recording" ? "Listening to your response" : "Speaking examiner"}</span>
          </div>
        </aside>
      </section>
    </main>
  );
}
