import type { Meta, StoryObj } from "@storybook/react-vite";

import { LoadingState } from "./loading-state";

const meta = {
  title: "Components/LoadingState",
  component: LoadingState,
  tags: ["autodocs"],
} satisfies Meta<typeof LoadingState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Block: Story = {
  args: { variant: "block" },
};

export const Table: Story = {
  args: { variant: "table", rows: 4, columns: 3 },
};

export const Stat: Story = {
  args: { variant: "stat" },
};

export const List: Story = {
  args: { variant: "list", rows: 4 },
};
