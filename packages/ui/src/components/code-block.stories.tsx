import type { Meta, StoryObj } from "@storybook/react-vite";

import { CodeBlock } from "./code-block";
import { StatusChip } from "./status-chip";

const meta = {
  title: "Components/CodeBlock",
  component: CodeBlock,
  tags: ["autodocs"],
  args: {
    code: "bun install\nbun run check",
    label: "shell",
  },
} satisfies Meta<typeof CodeBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Bare: Story = {};

export const Framed: Story = {
  args: { frame: true },
};

export const FramedWithStatus: Story = {
  args: {
    frame: true,
    status: <StatusChip label="Passing" tone="success" dot />,
  },
};
