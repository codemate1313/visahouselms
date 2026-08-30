import type {
  ExamModulePart,
  ExamModuleType,
  ExamSection,
  QuestionDraft,
  QuestionOption,
  QuestionType,
  SpeakingTurnType,
} from "@/api/types";

export const MODULE_TYPES = new Set<ExamModuleType>(["reading", "speaking", "writing", "listening", "full_mock", "final_test"]);
export const CHOICE_TYPES = new Set<QuestionType>(["mcq_single", "mcq_multiple", "true_false_not_given", "yes_no_not_given", "matching_unique", "matching_reusable"]);
export const ANSWER_FREE_TYPES = new Set<QuestionType>(["essay", "speaking_prompt"]);
export const COMPOSITE_TYPES = new Set<ExamModuleType>(["full_mock", "final_test"]);
/* Only Full Mock is assembled by picking (and optionally shuffling) 4
   completed source modules. Final Test is authored like a standalone module -
   its own custom Reading/Listening/Writing/Speaking PDF and question inputs
   per part - so it is excluded here even though it shares Full Mock's part
   layout and derived duration. */
export const MOCK_SOURCE_TYPES = new Set<ExamModuleType>(["full_mock"]);
export const DERIVED_DURATION_MODULE_TYPES = new Set<ExamModuleType>(["speaking", "full_mock", "final_test"]);
export const SOURCE_SECTIONS: ExamSection[] = ["listening", "reading", "writing", "speaking"];
/* Layouts where the candidate meets one composed task - a gapped passage, a
   notepad, a set of source texts - and the question rows behind it exist only
   to score each answer independently. These are authored in their own composer
   panel, never through the per-question form. */
export const COMPOSED_TASK_LAYOUTS = new Set<string>(["inline_matching_blanks", "source_text_matching", "notepad_gaps"]);

export function optionsFor(type: QuestionType, optionCount = 3): QuestionOption[] {
  if (type === "true_false_not_given") return ["True", "False", "Not Given"].map((text, index) => ({ key: String.fromCharCode(65 + index), text }));
  if (type === "yes_no_not_given") return ["Yes", "No", "Not Given"].map((text, index) => ({ key: String.fromCharCode(65 + index), text }));
  if (CHOICE_TYPES.has(type)) {
    return Array.from({ length: optionCount }, (_, index) => ({
      key: String.fromCharCode(65 + index),
      text: "",
    }));
  }
  return [];
}

export function defaultSpeakingTurn(part: ExamModulePart, pendingOffset = 0): SpeakingTurnType | null {
  const requiredTurns = part.answer_constraints.required_turn_types ?? [];
  const allowedTurns = part.answer_constraints.allowed_turn_types ?? [];
  const usedTurns = new Set(part.questions.map((question) => question.interaction?.turn_type).filter(Boolean));

  for (let index = 0; index < pendingOffset; index += 1) {
    const nextMissing = requiredTurns.find((turn) => !usedTurns.has(turn));
    if (nextMissing) {
      usedTurns.add(nextMissing);
    }
  }

  const missingRequired = requiredTurns.find((turn) => !usedTurns.has(turn));
  if (missingRequired) return missingRequired as SpeakingTurnType;
  /* Once every required turn is present, further prompts repeat the part's bank
     turn: the first allowed turn that is not capped at one. Speaking 1 banks
     topic questions, Speaking 3 and 4 bank follow-ups. This used to return
     "follow_up" for any part that allowed it, which made Part 1 prompts 3-6
     follow-ups rather than the five topic questions the format asks for - and,
     because follow-ups carry `adaptive_follow_up`, quietly handed them to the
     AI interlocutor to rewrite at runtime. */
  const singletonTurns = part.answer_constraints.singleton_turn_types ?? [];
  const bankTurn = allowedTurns.find((turn) => !singletonTurns.includes(turn));
  return (bankTurn ?? allowedTurns[0] ?? null) as SpeakingTurnType | null;
}

/**
 * The preparation/response seconds a new prompt of this turn type starts from.
 *
 * Speaking 3 holds a read-aloud with 20 seconds of preparation next to
 * follow-up questions with none, and Speaking 4 a two-minute presentation next
 * to those same short follow-ups, so the default has to be chosen per turn
 * rather than per part. `suggested_*` is the fallback for a part whose
 * constraints predate per-turn timings; null means the author sets it, which
 * the form requires before the prompt can be saved.
 */
export function speakingTurnTiming(
  part: ExamModulePart,
  turnType: SpeakingTurnType | null,
): { preparation_seconds: number | null; response_seconds: number | null } {
  const perTurn = turnType ? part.answer_constraints.turn_timings?.[turnType] : undefined;
  return {
    preparation_seconds: perTurn?.preparation_seconds ?? part.answer_constraints.suggested_preparation_seconds ?? null,
    response_seconds: perTurn?.response_seconds ?? part.answer_constraints.suggested_response_seconds ?? null,
  };
}

export function emptyQuestion(part: ExamModulePart): QuestionDraft {
  const type = part.answer_constraints.allowed_question_types?.[0] ?? "short_answer";
  const points = part.max_marks && part.question_limit ? Number(part.max_marks) / part.question_limit : 1;
  const firstQuestion = part.questions[0];
  const isPlaceholder = (text: string, key: string) =>
    text.trim().toLowerCase() === `option ${key.toLowerCase()}` ||
    text.trim().toLowerCase() === `option ${key}`.toLowerCase();

  const sharedOptions = part.answer_constraints.shared_options && firstQuestion
    ? firstQuestion.options.map((option) => ({
        key: option.key,
        text: isPlaceholder(option.text, option.key) ? "" : option.text,
      }))
    : optionsFor(type, part.answer_constraints.option_count ?? 3);
  const usedAnswers = new Set(part.questions.flatMap((question) => question.correct_answers));
  const defaultAnswer = part.answer_constraints.unique_answers
    ? sharedOptions.find((option) => !usedAnswers.has(option.key))?.key ?? ""
    : "A";
  const groupSize = part.answer_constraints.questions_per_group ?? 1;
  const groupLabel = part.answer_constraints.group_label_required
    ? `Conversation ${Math.floor(part.questions.length / groupSize) + 1}`
    : null;
  const turnType = defaultSpeakingTurn(part);
  const turnTiming = speakingTurnTiming(part, turnType);
  const defaultPrompt = "";
  return {
    question_type: type,
    prompt: defaultPrompt,
    instructions: null,
    passage: part.answer_constraints.shared_passage
      ? (firstQuestion?.passage ?? (typeof sessionStorage !== "undefined" ? sessionStorage.getItem(`vh.passage.${part.id}`) : null) ?? null)
      : null,
    image_path: null,
    image_url: null,
    options: sharedOptions,
    correct_answers: ANSWER_FREE_TYPES.has(type) || !defaultAnswer ? [] : [defaultAnswer],
    interaction: {
      group_label: groupLabel,
      turn_type: turnType,
      preparation_seconds: turnTiming.preparation_seconds,
      response_seconds: turnTiming.response_seconds,
      adaptive_follow_up: part.answer_constraints.interaction_mode === "ai_interlocutor" && turnType === "follow_up",
      // Wording is the author's; only the pause after it starts from the part's
      // default, so a heading typed in without touching the timing still plays
      // with a deliberate gap.
      heading: null,
      heading_gap_seconds: part.answer_constraints.spoken_heading
        ? part.answer_constraints.default_heading_gap_seconds ?? null
        : null,
      candidate_material_type: "none",
      candidate_material_path: null,
      candidate_material_url: null,
      candidate_material_name: null,
    },
    explanation: null,
    points,
    difficulty: "medium",
  };
}

export function questionPayload(question: QuestionDraft) {
  const candidateMaterialType = question.question_type === "speaking_prompt"
    ? question.interaction?.candidate_material_path
      ? "pdf"
      : question.image_path
        ? "image"
        : question.passage?.trim()
          ? "text"
          : "none"
    : question.interaction?.candidate_material_type || "none";

  // The heading Instructor speaks before the question, and the pause after it.
  // A prompt without a heading carries neither: an orphan pause would be a
  // number the exam never reaches.
  const heading = question.interaction?.heading?.trim() || null;

  return {
    question_type: question.question_type,
    prompt: question.prompt.trim(),
    instructions: question.instructions?.trim() || null,
    passage: question.passage?.trim() || null,
    image_path: question.image_path || null,
    options: CHOICE_TYPES.has(question.question_type) ? question.options.filter((option) => option.text.trim()) : [],
    correct_answers: ANSWER_FREE_TYPES.has(question.question_type) ? [] : question.correct_answers.map((answer) => answer.trim().toUpperCase()).filter(Boolean),
    interaction: {
      group_label: question.interaction?.group_label?.trim() || null,
      turn_type: question.interaction?.turn_type || null,
      preparation_seconds: question.interaction?.preparation_seconds ?? null,
      response_seconds: question.interaction?.response_seconds ?? null,
      adaptive_follow_up: Boolean(question.interaction?.adaptive_follow_up),
      heading,
      heading_gap_seconds: heading ? question.interaction?.heading_gap_seconds ?? null : null,
      candidate_material_type: candidateMaterialType,
      candidate_material_path: question.interaction?.candidate_material_path || null,
      candidate_material_name: question.interaction?.candidate_material_name?.trim() || null,
    },
    explanation: question.explanation?.trim() || null,
    points: Number(question.points),
    difficulty: question.difficulty,
  };
}

/**
 * The notepad line a given blank sits on, as a standalone question prompt.
 *
 * Notepad blanks are stored one question row per blank so each scores its own
 * mark, and every row still has to satisfy the part's `{{blank}}` marker rule.
 * The row's prompt is therefore its own line from the notepad, with the
 * numbered marker rewritten to the plain one. The full notepad travels on
 * `passage`, which is what the candidate actually reads.
 */
export function notepadPromptForBlank(notepad: string, blank: number): string {
  const marker = `{{blank:${blank}}}`;
  const line = notepad.split(/\r?\n/).find((item) => item.includes(marker)) ?? marker;
  return line
    .split(marker).join("{{blank}}")
    // Any other blank sharing this line belongs to its own row, so it reads as
    // a gap here rather than leaking a marker into grading and review screens.
    .replace(/\{\{blank:\d+\}\}/g, "______")
    .trim();
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
    specs: ["4 Listening Parts", "30 Questions", "Audio Played Twice"],
    tagline: "Build the four-part LanguageCert Academic listening paper with 30 auto-marked questions.",
    durationPresets: [20, 30, 40, 50, 60],
    sampleInstructions: "You will hear each recording twice. Answer all 30 questions across the four Listening parts.",
  },
  reading: {
    icon: "courses",
    badge: "Academic Reading Passages",
    defaultDuration: 50,
    specs: ["5 Reading Parts", "30 Questions", "Matching & MCQ"],
    tagline: "Create all five LanguageCert Academic Reading formats, including both matching task types.",
    durationPresets: [20, 30, 40, 50, 60],
    sampleInstructions: "You have 50 minutes to answer 30 questions across Reading Parts 1A, 1B, 2, 3, and 4.",
  },
  writing: {
    icon: "edit",
    badge: "Essay & Task Evaluation",
    defaultDuration: 50,
    specs: ["2 Tasks", "150-200 words for task 1", "250 Words for task 2"],
    tagline: "Design Task 1 chart & Task 2 essay prompts with automatic word counters & AI feedback.",
    durationPresets: [30, 45, 50, 60, 90, 100, 120],
    sampleInstructions: "You have 50 minutes for both tasks. Write 150–200 words for Task 1 and approximately 250 words for Task 2.",
  },
  speaking: {
    icon: "microphone",
    badge: "Interactive Speaking Interview",
    defaultDuration: 14,
    specs: ["4 Speaking Parts", "14 Minutes", "Timed Recording"],
    tagline: "Set up the four-part LanguageCert Academic Speaking interview with exact preparation rules.",
    durationPresets: [10, 14, 20, 30],
    sampleInstructions: "Parts 1 and 2 have no preparation time. Part 3 allows 20 seconds and Part 4 allows one minute of preparation.",
  },
  full_mock: {
    icon: "overview",
    badge: "Full Exam Simulation",
    defaultDuration: 154,
    specs: ["4 Skills", "154 Minutes", "0-100 Practice Score"],
    tagline: "Combine completed Listening, Reading, Writing, and Speaking modules into a full test simulation.",
    durationPresets: [120, 150, 154, 180, 210],
    sampleInstructions: "This is a full LanguageCert Academic practice test covering Listening, Reading, Writing, and Speaking.",
  },
  final_test: {
    icon: "analytics",
    badge: "Official Exit Assessment",
    defaultDuration: 154,
    specs: ["Final Assessment", "4 Skills", "Strict Test Security"],
    tagline: "Combine 4 section modules into an official course completion exit exam to evaluate student readiness.",
    durationPresets: [120, 150, 154, 180, 210],
    sampleInstructions: "This final assessment measures all four LanguageCert Academic skills under strict test conditions.",
  },
};
