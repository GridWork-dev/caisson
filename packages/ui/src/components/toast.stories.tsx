import type { Meta, StoryObj } from "@storybook/react-vite";

import { Toast } from "./toast";

const meta = {
  title: "Components/Toast",
  component: Toast,
  tags: ["autodocs"],
  args: {
    title: "License issued",
    children: "CS-9F2A-4K1B is ready to activate.",
  },
} satisfies Meta<typeof Toast>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Info: Story = {
  args: { tone: "info" },
};

export const Success: Story = {
  args: { tone: "success" },
};

export const Warning: Story = {
  args: { tone: "warning", title: "Seat limit approaching" },
};

export const Danger: Story = {
  args: { tone: "danger", title: "Payment failed" },
};

export const Dismissible: Story = {
  args: { onDismiss: () => {} },
};
