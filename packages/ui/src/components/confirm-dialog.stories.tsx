import { useState } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./button";
import { ConfirmDialog, type ConfirmDialogProps } from "./confirm-dialog";

function ConfirmDialogDemo(
  props: Omit<ConfirmDialogProps, "open" | "onConfirm" | "onCancel">,
) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Reopen</Button>
      <ConfirmDialog
        {...props}
        open={open}
        onConfirm={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

const meta = {
  title: "Components/ConfirmDialog",
  component: ConfirmDialogDemo,
  tags: ["autodocs"],
  args: {
    title: "Revoke license?",
    message:
      "This immediately blocks the seat from validating. This cannot be undone.",
  },
} satisfies Meta<typeof ConfirmDialogDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Danger: Story = {
  args: { tone: "danger", confirmLabel: "Revoke" },
};

export const Busy: Story = {
  args: { busy: true },
};
