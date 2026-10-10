import type { Meta, StoryObj } from "@storybook/react-vite";

import { Accordion, type AccordionProps } from "./accordion";

const ITEMS = [
  {
    id: "a",
    trigger: "What is Caisson?",
    content: "A composable base plus five module families.",
  },
  {
    id: "b",
    trigger: "Is it Bun-native?",
    content: "Yes, Bun is the primary runtime and package manager.",
  },
  {
    id: "c",
    trigger: "Can I self-host?",
    content: "Yes, via the create-caisson generator.",
  },
];

const meta = {
  title: "Components/Accordion",
  component: Accordion,
  tags: ["autodocs"],
  args: {
    items: ITEMS,
  } satisfies Partial<AccordionProps>,
} satisfies Meta<typeof Accordion>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Multiple: Story = {
  args: { type: "multiple" },
};

export const SingleExclusive: Story = {
  args: { type: "single", name: "accordion-trial-group" },
};
