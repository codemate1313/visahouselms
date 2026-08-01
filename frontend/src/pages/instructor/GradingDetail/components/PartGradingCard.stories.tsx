import type { Meta, StoryObj } from "@storybook/react-vite";
import type { AttemptPart } from "@/api/types";
import { PartGradingCard } from "./PartGradingCard";

const speakingRubric = [
  {
    criterion: "Task Fulfilment and Communicative Effect",
    max_marks: 8,
    description: "Ability to manage the task at the required level and link utterances into clear responses.",
  },
  {
    criterion: "Coherence",
    max_marks: 8,
    description: "Ability to give coherent responses, especially in extended speech, and sustain interaction.",
  },
  {
    criterion: "Lexical Resource",
    max_marks: 8,
    description: "Range and control of vocabulary for familiar and academic topics.",
  },
  {
    criterion: "Pronunciation and Fluency",
    max_marks: 8,
    description: "Intelligibility, rhythm, stress, pace, and confidence during spoken delivery.",
  },
];

const cefrScale = [
  {
    level: "Below B1" as const,
    marks: "0-3.5 / 8",
    descriptor: "Speech needs more consistency in connected delivery, intelligibility, and independent interaction.",
  },
  {
    level: "B1" as const,
    marks: "4-4.5 / 8",
    descriptor: "Can connect phrases to describe experiences and give brief reasons while handling familiar interactions.",
  },
  {
    level: "B2" as const,
    marks: "5-5.5 / 8",
    descriptor: "Can interact with useful fluency and give clear, detailed speech while explaining a viewpoint.",
  },
  {
    level: "C1" as const,
    marks: "6-7.5 / 8",
    descriptor: "Can speak fluently and flexibly, formulate ideas precisely, and produce clear contributions.",
  },
  {
    level: "C2" as const,
    marks: "8 / 8",
    descriptor: "Can participate effortlessly and express fine shades of meaning with consistently controlled speech.",
  },
];

const speakingPart: AttemptPart = {
  id: 611,
  section_type: "speaking",
  part_code: "speaking-1",
  title: "Speaking 1",
  skill_focus: "Give personal information and answer up to five questions on familiar topics.",
  instructions: null,
  duration_minutes: 5,
  auto_marked: false,
  max_marks: "32",
  rubric: speakingRubric,
  answer_constraints: {
    preparation_seconds: 5,
    response_seconds: 60,
  },
  cefr_scale: cefrScale,
  sort_order: 1,
  assets: [],
  question_count: 1,
  answered_count: 1,
  questions: [
    {
      id: 8101,
      question_type: "speaking_prompt",
      prompt: "Speaking 1: respond to the examiner's prompt about study habits and academic goals.",
      instructions: "Ask the candidate's name and country, then up to five questions.",
      passage: null,
      options: [],
      points: "8",
      sort_order: 1,
      response: { recorded: true },
      audio_path: "/storage/attempts/91/speaking-8101.webm",
      revision: 1,
    },
  ],
  grade: null,
};

const meta = {
  title: "Instructor/PartGradingCard",
  component: PartGradingCard,
  decorators: [
    (Story) => (
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
        <Story />
      </main>
    ),
  ],
  args: {
    part: speakingPart,
    attemptId: "91",
    canEdit: true,
    aiConfigured: false,
    isOpen: true,
    onGraded: () => undefined,
    onToggleOpen: () => undefined,
  },
} satisfies Meta<typeof PartGradingCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SpeakingWithAudio: Story = {};

export const SpeakingMissingAudio: Story = {
  args: {
    part: {
      ...speakingPart,
      answered_count: 0,
      questions: [
        {
          ...speakingPart.questions[0],
          response: null,
          audio_path: null,
        },
      ],
    },
  },
};
