import type { Meta, StoryObj } from "@storybook/react-vite";

import { SkuMatrix } from "./sku-matrix";

const meta = {
  title: "Components/SkuMatrix",
  component: SkuMatrix,
  tags: ["autodocs"],
  args: {
    columns: ["Compliance", "AI-Production", "Everything"],
    rows: [
      { label: "Field-level crypto", cells: [true, false, true] },
      { label: "WORM audit ledger", cells: [true, false, true] },
      { label: "AI eval harness", cells: [false, true, true] },
      { label: "Price", cells: ["$149", "$149", "$399"] },
    ],
  },
} satisfies Meta<typeof SkuMatrix>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
