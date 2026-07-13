import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./button";
import { MobileBuyBar } from "./mobile-buy-bar";

const meta = {
  title: "Components/MobileBuyBar",
  component: MobileBuyBar,
  tags: ["autodocs"],
  args: {
    label: "Compliance bundle",
    price: "$149",
    action: <Button variant="primary">Add to cart</Button>,
  },
} satisfies Meta<typeof MobileBuyBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
