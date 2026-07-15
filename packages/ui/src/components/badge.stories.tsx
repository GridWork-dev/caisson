import type { Meta, StoryObj } from "@storybook/react-vite";

import { Badge } from "./badge";

const meta = {
  title: "Components/Badge",
  component: Badge,
  tags: ["autodocs"],
  args: {
    children: "New",
  },
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Neutral: Story = {
  args: { tone: "neutral" },
};

export const Accent: Story = {
  args: { tone: "accent" },
};

export const Success: Story = {
  args: { tone: "success", children: "Active" },
};

export const Danger: Story = {
  args: { tone: "danger", children: "Deprecated" },
};

export const Small: Story = {
  args: { size: "sm" },
};
