import type { Meta, StoryObj } from "@storybook/react-vite";

import { FormField } from "./form-field";

const meta = {
  title: "Components/FormField",
  component: FormField,
  tags: ["autodocs"],
  args: {
    label: "Email",
    children: <input type="email" placeholder="you@example.com" />,
  },
} satisfies Meta<typeof FormField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHelperText: Story = {
  args: { helperText: "We only use this for license delivery." },
};

export const WithError: Story = {
  args: { error: "Enter a valid email address." },
};

export const Mono: Story = {
  args: {
    label: "License key",
    mono: true,
    children: <input type="text" defaultValue="CS-9F2A-4K1B" readOnly />,
  },
};
