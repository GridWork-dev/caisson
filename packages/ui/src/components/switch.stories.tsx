import { useState } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";

import { Switch, type SwitchProps } from "./switch";

function SwitchDemo(props: Omit<SwitchProps, "checked" | "onCheckedChange">) {
  const [checked, setChecked] = useState(false);
  return <Switch {...props} checked={checked} onCheckedChange={setChecked} />;
}

const meta = {
  title: "Components/Switch",
  component: SwitchDemo,
  tags: ["autodocs"],
  args: {
    label: "Auto-renew",
  },
} satisfies Meta<typeof SwitchDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const IconOnly: Story = {
  args: { label: undefined, "aria-label": "Auto-renew" },
};
