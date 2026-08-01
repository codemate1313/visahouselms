import type { Meta, StoryObj } from "@storybook/react-vite";
import { MicrophoneCheck } from "./MicrophoneCheck";

const meta = {
  title: "Speaking/MicrophoneCheck",
  component: MicrophoneCheck,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    testTitle: "Sample Speaking Course - Academic Set 1",
    onReady: () => undefined,
    onCancel: () => undefined,
  },
} satisfies Meta<typeof MicrophoneCheck>;

export default meta;

type Story = StoryObj<typeof meta>;

export const BeforeTest: Story = {};
