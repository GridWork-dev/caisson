import type { Meta, StoryObj } from "@storybook/react-vite";

import { DetailList } from "./detail-list";

const meta = {
  title: "Components/DetailList",
  component: DetailList,
  tags: ["autodocs"],
  args: {
    items: [
      { term: "Plan", description: "Compliance bundle" },
      { term: "License key", description: "CS-9F2A-4K1B", mono: true },
      { term: "Docs", description: "View documentation", href: "#docs" },
    ],
  },
} satisfies Meta<typeof DetailList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Stacked: Story = {
  args: { layout: "stacked" },
};

export const Columns: Story = {
  args: { layout: "columns" },
};
