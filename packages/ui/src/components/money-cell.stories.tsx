import type { Meta, StoryObj } from "@storybook/react-vite";

import { MoneyCell } from "./money-cell";

const meta = {
  title: "Components/MoneyCell",
  component: MoneyCell,
  tags: ["autodocs"],
  args: {
    value: 14900,
  },
} satisfies Meta<typeof MoneyCell>;

export default meta;

type Story = StoryObj<typeof meta>;

export const UsdCents: Story = {
  args: { value: 14900, unit: "usd-cents" },
};

export const Credits: Story = {
  args: { value: 4820, unit: "credits" },
};

export const SignedPositive: Story = {
  args: { value: 320, unit: "credits", sign: true, signTone: true },
};

export const SignedNegative: Story = {
  args: { value: -150, unit: "credits", sign: true, signTone: true },
};
