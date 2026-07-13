import type { Meta, StoryObj } from "@storybook/react-vite";

import { Select } from "./select";

const meta = {
  title: "Components/Select",
  component: Select,
  tags: ["autodocs"],
  args: {
    options: [
      { value: "compliance", label: "Compliance" },
      { value: "ai-production", label: "AI-Production" },
      { value: "everything", label: "Everything" },
    ],
    "aria-label": "Bundle",
  },
} satisfies Meta<typeof Select>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithPlaceholder: Story = {
  args: { placeholder: "Choose a bundle…" },
};

export const Invalid: Story = {
  args: { invalid: true },
};
