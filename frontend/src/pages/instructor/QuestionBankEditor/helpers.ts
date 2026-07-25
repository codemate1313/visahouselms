import type { QuestionDraft, QuestionOption, QuestionType } from "@/api/types";

export const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "mcq_single", label: "MCQ — one answer" },
  { value: "mcq_multiple", label: "MCQ — multiple answers" },
  { value: "true_false_not_given", label: "True / False / Not Given" },
  { value: "yes_no_not_given", label: "Yes / No / Not Given" },
  { value: "short_answer", label: "Short answer" },
  { value: "fill_blank", label: "Fill in the blank" },
  { value: "essay", label: "Writing task" },
  { value: "speaking_prompt", label: "Speaking prompt" },
];

export const CHOICE_TYPES = new Set<QuestionType>(["mcq_single", "mcq_multiple", "true_false_not_given", "yes_no_not_given"]);
export const ANSWER_FREE_TYPES = new Set<QuestionType>(["essay", "speaking_prompt"]);

export function defaultOptions(): QuestionOption[] {
  return ["A", "B", "C", "D"].map((key) => ({ key, text: "" }));
}

export function emptyQuestion(): QuestionDraft {
  return { question_type: "mcq_single", prompt: "", instructions: null, passage: null, options: defaultOptions(), correct_answers: ["A"], explanation: null, points: 1, difficulty: "medium" };
}

export function questionPayload(question: QuestionDraft) {
  return {
    question_type: question.question_type,
    prompt: question.prompt,
    instructions: question.instructions || null,
    passage: question.passage || null,
    options: CHOICE_TYPES.has(question.question_type) ? question.options.filter((option) => option.text.trim()) : [],
    correct_answers: ANSWER_FREE_TYPES.has(question.question_type) ? [] : question.correct_answers.map((answer) => answer.trim().toUpperCase()).filter(Boolean),
    explanation: question.explanation || null,
    points: Number(question.points),
    difficulty: question.difficulty,
  };
}

export function typeLabel(type: QuestionType): string {
  return QUESTION_TYPES.find((item) => item.value === type)?.label ?? type;
}
