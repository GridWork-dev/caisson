import type { Meta, StoryObj } from "@storybook/react-vite";

import { BundleCard } from "./bundle-card";
import { StatusChip } from "./status-chip";

const meta = {
  title: "Components/BundleCard",
  component: BundleCard,
  tags: ["autodocs"],
  args: {
    href: "#compliance",
    name: "Compliance",
    icon: "shield",
    status: <StatusChip label="Most popular" tone="accent" />,
    line: "SOC 2 / HIPAA controls, WORM audit ledger, field-level crypto.",
  },
} satisfies Meta<typeof BundleCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Lead: Story = {
  args: {
    lead: true,
    proof: "$ caisson audit verify --chain\n✓ 4,820 entries, unbroken",
  },
};
