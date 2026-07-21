import type { Attempt, AttemptQuestion } from "../../api/types";

export interface AttemptMetrics {
  total: number;
  attempted: number;
  correct: number;
  incorrect: number;
  pending: number;
  unanswered: number;
}

export function hasAttemptResponse(question: AttemptQuestion): boolean {
  const response = question.response;
  if (question.audio_path || response?.recorded) return true;
  if (!response) return false;
  if (Array.isArray(response.selected)) return response.selected.length > 0;
  if (typeof response.selected === "string") return response.selected.trim().length > 0;
  return typeof response.text === "string" && response.text.trim().length > 0;
}

export function getAttemptMetrics(attempt: Attempt): AttemptMetrics {
  const questions = attempt.parts.flatMap((part) => part.questions);
  const attemptedQuestions = questions.filter(hasAttemptResponse);
  const correct = attemptedQuestions.filter((question) => question.is_correct === true).length;
  const incorrect = attemptedQuestions.filter((question) => question.is_correct === false).length;

  return {
    total: questions.length,
    attempted: attemptedQuestions.length,
    correct,
    incorrect,
    pending: Math.max(0, attemptedQuestions.length - correct - incorrect),
    unanswered: Math.max(0, questions.length - attemptedQuestions.length),
  };
}

export function formatAttemptAnswer(question: AttemptQuestion): string {
  if (question.response?.selected) {
    return Array.isArray(question.response.selected)
      ? question.response.selected.join(", ")
      : question.response.selected;
  }
  if (question.response?.text?.trim()) return question.response.text;
  if (question.audio_path || question.response?.recorded) return "Recorded response";
  return "Unanswered";
}
