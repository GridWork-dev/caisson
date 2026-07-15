import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./button";
import { EmptyState } from "./empty-state";

const meta = {
  title: "Components/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  args: {
    title: "No ledger activity yet",
  },
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithDescriptionAndAction: Story = {
  args: {
    description:
      "Credit grants and debits will appear here once your plan activates.",
    action: <Button variant="primary">View pricing</Button>,
  },
};

export const NoIcon: Story = {
  args: { icon: null },
};
