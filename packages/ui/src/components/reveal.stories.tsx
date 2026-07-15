import type { Meta, StoryObj } from "@storybook/react-vite";

import { Card } from "./card";
import { Reveal } from "./reveal";

const meta = {
  title: "Components/Reveal",
  component: Reveal,
  tags: ["autodocs"],
  args: {
    children: <Card>Revealed content.</Card>,
  },
} satisfies Meta<typeof Reveal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Up: Story = {
  args: { direction: "up" },
};

export const Left: Story = {
  args: { direction: "left" },
};

export const NoMotion: Story = {
  name: "direction: none (fade only)",
  args: { direction: "none" },
};

export const Delayed: Story = {
  args: { direction: "up", delay: 150 },
};
