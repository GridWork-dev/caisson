import { useState } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";

import { Checkbox, type CheckboxProps } from "./checkbox";

function CheckboxDemo({ defaultChecked, ...props }: CheckboxProps) {
  const [checked, setChecked] = useState(defaultChecked ?? false);
  return (
    <Checkbox
      {...props}
      checked={checked}
      onChange={(e) => setChecked(e.target.checked)}
    />
  );
}

const meta = {
  title: "Components/Checkbox",
  component: CheckboxDemo,
  tags: ["autodocs"],
  args: {
    label: "Enable AI evals",
  },
} satisfies Meta<typeof CheckboxDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Checked: Story = {
  args: { defaultChecked: true },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const NoLabel: Story = {
  name: "no label (bare control)",
  args: { label: undefined, "aria-label": "Enable AI evals" },
};
