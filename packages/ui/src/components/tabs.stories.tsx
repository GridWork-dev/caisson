import { useState } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";

import { Tabs, type TabItem, type TabsProps } from "./tabs";

const ITEMS: TabItem[] = [
  { id: "overview", label: "Overview", panel: "Overview panel content." },
  { id: "usage", label: "Usage", panel: "Usage panel content." },
  {
    id: "billing",
    label: "Billing",
    panel: "Billing panel content.",
    disabled: true,
  },
];

/** Tabs is controlled (`value` + `onValueChange`), so every story owns its selection state. */
function TabsDemo(props: Omit<TabsProps, "value" | "onValueChange">) {
  const [value, setValue] = useState(props.items[0]?.id ?? "");
  return <Tabs {...props} value={value} onValueChange={setValue} />;
}

const meta = {
  title: "Components/Tabs",
  component: TabsDemo,
  tags: ["autodocs"],
  args: {
    items: ITEMS,
    "aria-label": "Account sections",
  },
} satisfies Meta<typeof TabsDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  args: { orientation: "horizontal" },
};

export const Vertical: Story = {
  args: { orientation: "vertical" },
};
