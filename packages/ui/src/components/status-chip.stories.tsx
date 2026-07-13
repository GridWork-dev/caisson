import type { Meta, StoryObj } from "@storybook/react-vite";

import { StatusChip } from "./status-chip";

const meta = {
  title: "Components/StatusChip",
  component: StatusChip,
  tags: ["autodocs"],
} satisfies Meta<typeof StatusChip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Muted: Story = {
  args: { label: "Pending", tone: "muted" },
};

export const Success: Story = {
  args: { label: "Active", tone: "success", dot: true },
};

export const Accent: Story = {
  args: { label: "Beta", tone: "accent" },
};

export const WithIcon: Story = {
  args: { label: "Locked", tone: "muted", icon: "lock" },
};
