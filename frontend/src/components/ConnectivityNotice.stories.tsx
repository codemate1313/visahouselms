import type { Meta, StoryObj } from "@storybook/react-vite";
import { ConnectivityNoticeDialog } from "./ConnectivityNotice";

const meta = {
  title: "Feedback/ConnectivityNotice",
  component: ConnectivityNoticeDialog,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    checking: false,
    recheckFailed: false,
    onRecheck: () => undefined,
  },
} satisfies Meta<typeof ConnectivityNoticeDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Connection just dropped - the notice explains why nothing is saving. */
export const Offline: Story = {};

/** The button was pressed and the probe is in flight. */
export const Rechecking: Story = { args: { checking: true } };

/** The recheck came back still disconnected, so the notice says so rather than
    looking as though the button did nothing. */
export const StillOffline: Story = { args: { recheckFailed: true } };
