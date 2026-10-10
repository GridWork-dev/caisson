import type { Meta, StoryObj } from "@storybook/react-vite";

import { Section } from "./section";

const meta = {
  title: "Components/Section",
  component: Section,
  tags: ["autodocs"],
  args: {
    eyebrow: "Compliance",
    title: "Start with the evidence in place",
    lede: "Every package composes onto the same tenancy-RLS + WORM-audit floor.",
    children: "Section body content.",
  },
} satisfies Meta<typeof Section>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TintBand: Story = {
  args: { band: "tint" },
};

export const Flush: Story = {
  args: { flush: true },
};

export const H1: Story = {
  name: "as: h1 (page top header)",
  args: { as: "h1" },
};
