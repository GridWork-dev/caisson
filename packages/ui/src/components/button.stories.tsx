import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./button";

const meta = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  args: {
    children: "Continue",
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { variant: "primary", size: "md" },
};

export const Ghost: Story = {
  args: { variant: "ghost", size: "md" },
};

export const Small: Story = {
  args: { variant: "primary", size: "sm" },
};

export const Disabled: Story = {
  args: { variant: "primary", disabled: true },
};

export const AsChildLink: Story = {
  name: "asChild (renders an <a>)",
  args: {
    asChild: true,
    variant: "ghost",
    children: <a href="#pricing">View pricing</a>,
  },
};
