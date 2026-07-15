import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./button";
import { ErrorState } from "./error-state";

const meta = {
  title: "Components/ErrorState",
  component: ErrorState,
  tags: ["autodocs"],
} satisfies Meta<typeof ErrorState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithRetryAction: Story = {
  args: { action: <Button variant="primary">Try again</Button> },
};

export const CustomMessage: Story = {
  args: {
    title: "Couldn't load your ledger",
    description: "The credit-ledger service is unreachable. Try again shortly.",
  },
};
