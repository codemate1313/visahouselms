import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import type { AttemptPart } from "@/api/types";
import { SpeakingInterviewStage } from "./SpeakingInterviewStage";

const baseQuestion = {
  id: 7101,
  question_type: "speaking_prompt" as const,
  prompt: "Speaking 1: respond to the examiner's prompt about study habits and academic goals.",
  instructions: "Ask the candidate's name and country, then up to five questions.",
  passage: null,
  options: [],
  points: "8",
  sort_order: 1,
  response: null,
  audio_path: null,
  revision: 1,
};

const speakingPart: AttemptPart = {
  id: 501,
  section_type: "speaking",
  part_code: "speaking-1",
  title: "Speaking 1",
  skill_focus: "Give personal information and answer up to five questions on familiar topics.",
  instructions: null,
  duration_minutes: 5,
  auto_marked: false,
  max_marks: "8",
  rubric: [],
  answer_constraints: {
    preparation_seconds: 5,
    response_seconds: 60,
  },
  cefr_scale: [],
  sort_order: 1,
  assets: [],
  question_count: 1,
  answered_count: 0,
  questions: [baseQuestion],
  grade: null,
};

const meta = {
  title: "Speaking/TestRunnerStage",
  component: SpeakingInterviewStage,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    attemptId: 91,
    moduleTitle: "Sample Speaking Course - Academic Set 1",
    currentPart: speakingPart,
    speakingPartNumber: 1,
    speakingPartCount: 4,
    isLastTestPart: false,
    secondsLeft: 927,
    savingIds: new Set<number>(),
    audioInputStream: null,
    recordingQuestionId: null,
    recordingFailedQuestionId: null,
    recordingErrorMessage: null,
    onRecord: async () => true,
    onContinuePart: () => undefined,
  },
} satisfies Meta<typeof SpeakingInterviewStage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ReadyToStart: Story = {};

export const PreparationCountdown: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /start response/i }));
  },
};

export const RecordingInProgress: Story = {
  args: {
    currentPart: {
      ...speakingPart,
      answer_constraints: {
        preparation_seconds: 0,
        response_seconds: 45,
      },
    },
    recordingQuestionId: baseQuestion.id,
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /start response/i }));
    await within(canvasElement).findByRole("button", { name: /submit response/i });
  },
};

export const ResponseSaved: Story = {
  args: {
    currentPart: {
      ...speakingPart,
      answered_count: 1,
      questions: [
        {
          ...baseQuestion,
          response: { recorded: true },
          audio_path: "/storage/attempts/91/speaking-7101.webm",
        },
      ],
    },
  },
};
