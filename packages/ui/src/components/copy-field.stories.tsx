import type { Meta, StoryObj } from "@storybook/react-vite";

import { CopyField } from "./copy-field";

const meta = {
  title: "Components/CopyField",
  component: CopyField,
  tags: ["autodocs"],
  args: {
    label: "License key",
    value: "CS-9F2A-4K1B",
  },
} satisfies Meta<typeof CopyField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Secret: Story = {
  args: { label: "API key", value: "sk_live_9f2a4k1b", secret: true },
};

export const NonMono: Story = {
  args: { label: "Org name", value: "Northwind Freight", mono: false },
};
