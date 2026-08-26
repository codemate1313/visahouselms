import type { Attempt, AttemptQuestion, AttemptPart } from "../../api/types";

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
  const questionToPartMap = new Map<number, AttemptPart>();
  attempt.parts.forEach((part) => {
    part.questions.forEach((q) => {
      questionToPartMap.set(q.id, part);
    });
  });

  const questions = attempt.parts.flatMap((part) => part.questions);
  const attemptedQuestions = questions.filter(hasAttemptResponse);

  let correct = 0;
  let incorrect = 0;
  let pending = 0;

  attemptedQuestions.forEach((question) => {
    const part = questionToPartMap.get(question.id);
    if (part) {
      if (!part.auto_marked) {
        // Subjective question (essay/recording)
        const grade = part.grade;
        if (grade && (grade.status === "graded" || grade.status === "ai_graded")) {
          let awarded = 0;
          let max = 0;
          (grade.criteria || []).forEach((c) => {
            awarded += parseFloat(c.marks_awarded) || 0;
            max += parseFloat(c.max_marks) || 0;
          });
          const pct = max > 0 ? (awarded / max) * 100 : 0;
          if (pct >= 50) {
            correct++;
          } else {
            incorrect++;
          }
        } else {
          pending++;
        }
      } else {
        // Objective question
        if (question.is_correct === true) {
          correct++;
        } else if (question.is_correct === false) {
          incorrect++;
        } else {
          pending++;
        }
      }
    } else {
      if (question.is_correct === true) {
        correct++;
      } else if (question.is_correct === false) {
        incorrect++;
      } else {
        pending++;
      }
    }
  });

  return {
    total: questions.length,
    attempted: attemptedQuestions.length,
    correct,
    incorrect,
    pending,
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
