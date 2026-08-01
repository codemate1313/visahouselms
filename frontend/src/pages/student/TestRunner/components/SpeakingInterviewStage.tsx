import { useEffect, useMemo, useRef, useState } from "react";
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
  const startingRef = useRef(false);
  const previousQuestionIdRef = useRef<number | null>(question?.id ?? null);
  const t = strings.speakingInterview;
  const preparationSeconds = currentPart.answer_constraints.preparation_seconds ?? 5;
  const responseSeconds = currentPart.answer_constraints.response_seconds ?? 60;
  const isLastQuestion = questionIndex >= currentPart.questions.length - 1;

  useEffect(() => {
    setQuestionIndex(firstOpenQuestion);
  }, [currentPart.id, firstOpenQuestion]);

  useEffect(() => {
    if (previousQuestionIdRef.current !== (question?.id ?? null)) {
      previousQuestionIdRef.current = question?.id ?? null;
      setMode(recorded ? "complete" : "ready");
      setPreparationLeft(0);
      setResponseLeft(0);
      startingRef.current = false;
    }
  }, [question?.id, recorded]);

  useEffect(() => {
    if (mode !== "preparing" || preparationLeft <= 0) return undefined;
    const timer = window.setTimeout(() => setPreparationLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [mode, preparationLeft]);

  useEffect(() => {
    if (mode !== "preparing" || preparationLeft !== 0 || !question || startingRef.current) return;
    startingRef.current = true;
    void onRecord(question.id).then((started) => {
      startingRef.current = false;
      if (started) {
        setResponseLeft(responseSeconds);
        setMode("recording");
      } else {
        setMode("ready");
      }
    });
  }, [mode, onRecord, preparationLeft, question, responseSeconds]);

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

  if (!question) return null;

  const beginPreparation = () => {
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

      <section className="speaking-interview-content">
        <div className="speaking-interview-progress">
          <span>{t.partProgress(speakingPartNumber, speakingPartCount)}</span>
          <span>{t.questionProgress(questionIndex + 1, currentPart.questions.length)}</span>
        </div>

        <div className="speaking-interview-avatar">
          <SpeakingAvatar
            attemptId={attemptId}
            avatarOnly
            isCandidateRecording={mode === "recording"}
            partId={currentPart.id}
            questionId={question.id}
          />
        </div>

        {question.passage && (
          <div className="speaking-interview-prompt">
            <div className="speaking-interview-passage">{question.passage}</div>
          </div>
        )}

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
          {mode === "ready" && (
            <Button leftIcon={<Icon name="play" />} onClick={beginPreparation} size="lg">
              {t.startResponse}
            </Button>
          )}
          {mode === "preparing" && (
            <Button disabled size="lg" variant="secondary">
              {t.getReady}
            </Button>
          )}
          {mode === "recording" && recordingQuestionId === question.id && (
            <Button leftIcon={<Icon name="check" />} onClick={submitResponse} size="lg">
              {t.submitResponse}
            </Button>
          )}
          {mode === "uploading" && (
            <Button disabled loading size="lg">
              {t.savingResponse}
            </Button>
          )}
          {mode === "complete" && (
            <Button rightIcon={<Icon name="arrowRight" />} onClick={continueInterview} size="lg">
              {isLastQuestion
                ? isLastTestPart ? t.reviewAndSubmit : t.continueToNextPart
                : t.continueToNextQuestion}
            </Button>
          )}
        </div>
      </section>
    </main>
  );
}
