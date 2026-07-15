import type { Meta, StoryObj } from "@storybook/react-vite";

import { StatusPill } from "./status-pill";

const meta = {
  title: "Components/StatusPill",
  component: StatusPill,
  tags: ["autodocs"],
} satisfies Meta<typeof StatusPill>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Active: Story = {
  args: { status: "active" },
};

export const Expired: Story = {
  args: { status: "expired" },
};

export const Revoked: Story = {
  args: { status: "revoked" },
};

export const Pending: Story = {
  args: { status: "pending" },
};
