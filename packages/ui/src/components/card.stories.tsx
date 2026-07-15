import type { Meta, StoryObj } from "@storybook/react-vite";

import { Card } from "./card";

const meta = {
  title: "Components/Card",
  component: Card,
  tags: ["autodocs"],
  args: {
    children: "Card body content.",
  },
} satisfies Meta<typeof Card>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const Accent: Story = {
  args: { accent: true },
};

export const Interactive: Story = {
  args: { interactive: true },
};

export const AccentInteractive: Story = {
  args: { accent: true, interactive: true },
};
