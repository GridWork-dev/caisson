import type { Meta, StoryObj } from "@storybook/react-vite";

import { Card } from "./card";
import { FeatureGrid } from "./feature-grid";

const meta = {
  title: "Components/FeatureGrid",
  component: FeatureGrid,
  tags: ["autodocs"],
  args: {
    children: (
      <>
        <Card>Field-level crypto</Card>
        <Card>WORM audit ledger</Card>
        <Card>Tenancy RLS</Card>
      </>
    ),
  },
} satisfies Meta<typeof FeatureGrid>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TwoColumn: Story = {
  args: { cols: 2 },
};

export const ThreeColumn: Story = {
  args: { cols: 3 },
};

export const Flush: Story = {
  args: { cols: 2, flush: true },
};
