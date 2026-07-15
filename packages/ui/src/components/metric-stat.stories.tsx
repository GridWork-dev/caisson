import type { Meta, StoryObj } from "@storybook/react-vite";

import { MetricStat } from "./metric-stat";

const meta = {
  title: "Components/MetricStat",
  component: MetricStat,
  tags: ["autodocs"],
  args: {
    label: "Credits remaining",
    value: "4,820",
  },
} satisfies Meta<typeof MetricStat>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Positive: Story = {
  args: { tone: "positive", hint: "+320 this cycle", icon: "wallet" },
};

export const Warning: Story = {
  args: {
    label: "License seats",
    value: "9 / 10",
    tone: "warning",
    hint: "1 seat left",
    icon: "users",
  },
};

export const Critical: Story = {
  args: {
    label: "Failed jobs",
    value: "3",
    tone: "critical",
    icon: "alert",
  },
};
