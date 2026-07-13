import type { Meta, StoryObj } from "@storybook/react-vite";

import { Icon } from "./icon";

const meta = {
  title: "Components/Icon",
  component: Icon,
  tags: ["autodocs"],
  args: {
    name: "shield",
  },
} satisfies Meta<typeof Icon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Medium: Story = {
  args: { size: "md" },
};

export const Large: Story = {
  args: { size: "lg" },
};

export const WithAccessibleLabel: Story = {
  args: { name: "alert", "aria-label": "Warning" },
};
