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

export interface ModuleMeta {
  icon: import("@/components/icons").IconName;
  badge: string;
  defaultDuration: number;
  specs: string[];
  tagline: string;
  durationPresets: number[];
  sampleInstructions: string;
}

export const MODULE_TYPE_META: Record<ExamModuleType, ModuleMeta> = {
  listening: {
    icon: "module",
    badge: "Audio Listening Test",
    defaultDuration: 40,
    specs: ["4 Audio Parts", "40 Questions", "Auto Band Scoring"],
    tagline: "Build a 4-part computer-delivered listening test with audio recordings & interactive questions.",
    durationPresets: [20, 30, 40, 60],
    sampleInstructions: "You will hear a number of different recordings and you will have to answer questions based on what you hear. All recordings will be played ONCE only.",
  },
  reading: {
    icon: "courses",
    badge: "Academic Reading Passages",
    defaultDuration: 60,
    specs: ["3 Passages", "40 Questions", "Text Highlighting"],
    tagline: "Craft multi-passage academic reading tests with passage highlighting and 40 questions.",
    durationPresets: [30, 45, 60, 90],
    sampleInstructions: "You have 60 minutes to read three passages and answer 40 questions. Write your answers clearly and pay strict attention to word limits.",
  },
  writing: {
    icon: "edit",
    badge: "Essay & Task Evaluation",
    defaultDuration: 60,
    specs: ["Task 1 & Task 2", "Word Counter", "AI Essay Feedback"],
    tagline: "Design Task 1 chart & Task 2 essay prompts with automatic word counters & AI feedback.",
    durationPresets: [30, 45, 60, 75],
    sampleInstructions: "You should spend about 20 minutes on Task 1 (minimum 150 words) and 40 minutes on Task 2 (minimum 250 words).",
  },
  speaking: {
    icon: "microphone",
    badge: "Interactive Speaking Interview",
    defaultDuration: 14,
    specs: ["3 Interview Parts", "Cue Card Timer", "Speech Recorder"],
    tagline: "Set up a 3-part interactive AI candidate interview with cue card timing rules & audio recording.",
    durationPresets: [10, 14, 20, 30],
    sampleInstructions: "Ensure your microphone is enabled. Speak clearly into the microphone. Part 1: intro questions (4-5m), Part 2: 1m prep + 2m talk, Part 3: discussion (4-5m).",
  },
  full_mock: {
    icon: "overview",
    badge: "Full Exam Simulation",
    defaultDuration: 174,
    specs: ["4 Combined Sections", "3-Hour Simulation", "Complete Band Score"],
    tagline: "Combine completed Listening, Reading, Writing, and Speaking modules into a full test simulation.",
    durationPresets: [120, 150, 174, 180],
    sampleInstructions: "This is a full-length mock test. Ensure you are in a quiet room without interruptions for approximately 3 hours.",
  },
  final_test: {
    icon: "analytics",
    badge: "Official Exit Assessment",
    defaultDuration: 174,
    specs: ["Final Certification", "Course Exit Exam", "Official Evaluation"],
    tagline: "Combine 4 section modules into an official course completion exit exam to evaluate student readiness.",
    durationPresets: [120, 150, 174, 180],
    sampleInstructions: "This final evaluation test assesses your overall band score across all four components under strict exam conditions.",
  },
};
