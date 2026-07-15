import type { Meta, StoryObj } from "@storybook/react-vite";

import { LedgerList, type LedgerEntry } from "./ledger-list";

const ENTRIES: LedgerEntry[] = [
  {
    id: "1",
    timestamp: "2026-07-01T14:00:00Z",
    reason: "Monthly grant",
    delta: 5000,
    balance: 5000,
  },
  {
    id: "2",
    timestamp: "2026-07-05T09:30:00Z",
    reason: "AI eval run",
    delta: -180,
    balance: 4820,
  },
  {
    id: "3",
    timestamp: "2026-07-10T18:12:00Z",
    reason: "Seat activation",
    delta: -100,
    balance: 4720,
  },
];

const meta = {
  title: "Components/LedgerList",
  component: LedgerList,
  tags: ["autodocs"],
  args: {
    entries: ENTRIES,
  },
} satisfies Meta<typeof LedgerList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = {
  args: { loading: true, loadingRows: 3 },
};

export const Empty: Story = {
  args: { entries: [] },
};

export const UsdCents: Story = {
  args: {
    unit: "usd-cents",
    entries: [
      {
        id: "1",
        timestamp: "2026-07-01T14:00:00Z",
        reason: "Subscription charge",
        delta: -14900,
        balance: 0,
      },
    ],
  },
};
