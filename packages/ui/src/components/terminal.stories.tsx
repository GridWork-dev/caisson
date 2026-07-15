import type { Meta, StoryObj } from "@storybook/react-vite";

import { StatusChip } from "./status-chip";
import { Terminal } from "./terminal";

const meta = {
  title: "Components/Terminal",
  component: Terminal,
  tags: ["autodocs"],
  args: {
    label: "bun run check",
    children: "✓ build\n✓ lint\n✓ test\n✓ gate",
  },
} satisfies Meta<typeof Terminal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithStatus: Story = {
  args: {
    status: <StatusChip label="Passing" tone="success" dot />,
  },
};

export const Failure: Story = {
  args: {
    children: "✓ build\n✓ lint\n✗ test — 1 failure\n— gate skipped",
    status: <StatusChip label="Failing" tone="accent" dot />,
  },
};
