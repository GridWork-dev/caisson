import type { Meta, StoryObj } from "@storybook/react-vite";

import { AppShell, type AppShellNavItem } from "./app-shell";
import { Card } from "./card";
import { ThemeToggle } from "./theme-toggle";

const NAV: AppShellNavItem[] = [
  { label: "Overview", href: "#overview", icon: "dashboard", active: true },
  { label: "Licenses", href: "#licenses", icon: "key" },
  { label: "Ledger", href: "#ledger", icon: "wallet" },
  { label: "Settings", href: "#settings", icon: "server" },
];

const meta = {
  title: "Components/AppShell",
  component: AppShell,
  tags: ["autodocs"],
  args: {
    nav: NAV,
    brand: <span>Caisson</span>,
    topBar: <ThemeToggle />,
    children: <Card>Dashboard content.</Card>,
  },
} satisfies Meta<typeof AppShell>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
