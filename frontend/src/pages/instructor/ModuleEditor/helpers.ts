import type {
  ExamModulePart,
  ExamModuleType,
  IeltsSection,
  QuestionDraft,
  QuestionOption,
  QuestionType,
} from "@/api/types";

export const MODULE_TYPES = new Set<ExamModuleType>(["reading", "speaking", "writing", "listening", "full_mock", "final_test"]);
export const CHOICE_TYPES = new Set<QuestionType>(["mcq_single", "mcq_multiple", "true_false_not_given", "yes_no_not_given"]);
export const ANSWER_FREE_TYPES = new Set<QuestionType>(["essay", "speaking_prompt"]);
export const COMPOSITE_TYPES = new Set<ExamModuleType>(["full_mock", "final_test"]);
export const SOURCE_SECTIONS: IeltsSection[] = ["listening", "reading", "writing", "speaking"];

export function optionsFor(type: QuestionType): QuestionOption[] {
  if (type === "true_false_not_given") return ["True", "False", "Not Given"].map((text, index) => ({ key: String.fromCharCode(65 + index), text }));
  if (type === "yes_no_not_given") return ["Yes", "No", "Not Given"].map((text, index) => ({ key: String.fromCharCode(65 + index), text }));
  if (type.startsWith("mcq_")) return ["A", "B", "C"].map((key) => ({ key, text: "" }));
  return [];
}

export function emptyQuestion(part: ExamModulePart): QuestionDraft {
  const type = part.answer_constraints.allowed_question_types?.[0] ?? "short_answer";
  const points = part.max_marks && part.question_limit ? Number(part.max_marks) / part.question_limit : 1;
  return {
    question_type: type,
    prompt: "",
    instructions: null,
    passage: null,
    options: optionsFor(type),
    correct_answers: ANSWER_FREE_TYPES.has(type) ? [] : ["A"],
    explanation: null,
    points,
    difficulty: "medium",
  };
}

export function questionPayload(question: QuestionDraft) {
  return {
    question_type: question.question_type,
    prompt: question.prompt.trim(),
    instructions: question.instructions?.trim() || null,
    passage: question.passage?.trim() || null,
    options: CHOICE_TYPES.has(question.question_type) ? question.options.filter((option) => option.text.trim()) : [],
    correct_answers: ANSWER_FREE_TYPES.has(question.question_type) ? [] : question.correct_answers.map((answer) => answer.trim().toUpperCase()).filter(Boolean),
    explanation: question.explanation?.trim() || null,
    points: Number(question.points),
    difficulty: question.difficulty,
  };
}

export function detectConversationSpeakers(conversation: string): string[] {
  const speakerLine = /^\s*\[?([A-Za-z][A-Za-z0-9 ._'-]{0,39})\]?\s*:\s*.+$/;
  const speakers = new Map<string, string>();
  let foundSpeakerLine = false;
  let hasNarratorPreamble = false;
  conversation.split(/\r?\n/).forEach((line) => {
    const match = line.match(speakerLine);
    if (!match) {
      if (line.trim() && !foundSpeakerLine) hasNarratorPreamble = true;
      return;
    }
    foundSpeakerLine = true;
    const name = match[1].trim().replace(/\s+/g, " ");
    if (!speakers.has(name.toLowerCase())) speakers.set(name.toLowerCase(), name);
  });
  if (speakers.size && hasNarratorPreamble) return ["Narrator", ...speakers.values()];
  if (!speakers.size && conversation.trim()) return ["Narrator"];
  return [...speakers.values()];
}
