import { useState } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./button";
import { Dialog, type DialogProps } from "./dialog";

/**
 * Dialog is a controlled component (`open` + `onClose`), so every story renders a small stateful
 * wrapper instead of the component directly — the same shape a real consumer owns.
 */
function DialogDemo(props: Omit<DialogProps, "open" | "onClose">) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Reopen</Button>
      <Dialog {...props} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

const meta = {
  title: "Components/Dialog",
  component: DialogDemo,
  tags: ["autodocs"],
  args: {
    title: "Confirm export",
    children: "This dialog opens on mount for visual + a11y review.",
  },
} satisfies Meta<typeof DialogDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Modal: Story = {
  args: { variant: "modal" },
};

export const DrawerRight: Story = {
  args: { variant: "drawer", side: "right" },
};

export const DrawerLeft: Story = {
  args: { variant: "drawer", side: "left" },
};

export const HiddenHeader: Story = {
  args: { hideHeader: true },
};
