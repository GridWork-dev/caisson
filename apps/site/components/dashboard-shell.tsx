"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  AppShell,
  type AppShellNavItem,
  type AppShellNavItemRenderProps,
} from "@caisson/ui/components";

const NAV_ITEMS: readonly Omit<AppShellNavItem, "active">[] = [
  { label: "Overview", href: "/dashboard", icon: "dashboard" },
  { label: "Credits", href: "/dashboard/credits", icon: "wallet" },
  { label: "License", href: "/dashboard/license", icon: "key" },
  { label: "Activity", href: "/dashboard/activity", icon: "gauge" },
  { label: "Plan", href: "/dashboard/plan", icon: "scale" },
  { label: "Cart", href: "/dashboard/cart", icon: "cart" },
];

export interface DashboardShellProps {
  /** Top-bar content (account id + sign-out) — built server-side in the layout. */
  topBar: ReactNode;
  children: ReactNode;
}

/**
 * Client wrapper over the kit `AppShell` (ADR-0114 scope item 6): computes each nav item's
 * `active` state from the current pathname (`usePathname`, client-only) and injects a real Next
 * `<Link>` via `renderNavItem` — the kit itself stays framework-agnostic (ADR-0099). The Overview
 * route (`/dashboard`) is active ONLY on an exact match; every other route is active on a prefix
 * match so a sub-route (none exist yet, but the pattern is the right default) still highlights its
 * parent nav item.
 */
export function DashboardShell({ topBar, children }: DashboardShellProps) {
  const pathname = usePathname();

  const nav: AppShellNavItem[] = NAV_ITEMS.map((item) => ({
    ...item,
    active:
      item.href === "/dashboard"
        ? pathname === "/dashboard"
        : pathname.startsWith(item.href),
  }));

  return (
    <AppShell
      nav={nav}
      topBar={topBar}
      renderNavItem={(item, renderProps: AppShellNavItemRenderProps) => (
        <Link href={item.href} {...renderProps} />
      )}
    >
      {children}
    </AppShell>
  );
}
