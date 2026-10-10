import type { Meta, StoryObj } from "@storybook/react-vite";

import { Faq } from "./faq";

const meta = {
  title: "Components/Faq",
  component: Faq,
  tags: ["autodocs"],
  args: {
    items: [
      {
        question: "Is Caisson open-core?",
        answer: "No. Every package is Apache-2.0.",
      },
      {
        question: "Does it support Bun?",
        answer: "Yes — Bun is the primary runtime and package manager.",
      },
      {
        question: "Can I self-host?",
        answer: "Yes, the generator scaffolds a standalone deployable app.",
      },
    ],
  },
} satisfies Meta<typeof Faq>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FirstOpen: Story = {
  args: { defaultOpenFirst: true },
};
