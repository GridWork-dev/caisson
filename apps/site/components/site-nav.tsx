import Link from "next/link";

import { ThemeToggle } from "@caisson/ui/components";
import { Wordmark } from "@caisson/brand";

import { CartTrigger } from "./cart-trigger";
import { MobileNav } from "./mobile-nav";
import { NavPanels, type NavPanelSpec } from "./nav-panels";
import { NavSearchTrigger } from "./nav-search-trigger";
import { Button } from "./button";
import { BUNDLE_MARKS } from "@/lib/marks";
import {
  BUNDLE_PRICES,
  bundlePriceById,
  formatPrice,
  formatUsd,
  isBundleId,
  planPrice,
} from "@/lib/pricing";

// Cheapest persona/Provenance bundle — computed, never hand-duplicated (the "from $X" bundle anchor).
const BUNDLE_MIN = Math.min(
  ...BUNDLE_PRICES.filter((b) => b.id !== "everything").map(
    (b) => b.amount ?? Infinity,
  ),
);
import { EDITION_ROUTES } from "@/lib/routes";
import styles from "./site-nav.module.css";

// Server component. ADR-0237 F3 arrangement: logo left → CENTERED trigger row (the three F4
// card panels: Editions / Marketplace / Resources) → right utility cluster (search · cart ·
// Get started · theme). The shell renders as RSC; the panel trio (NavPanels), the theme toggle,
// and the mobile drawer ship as client islands. Everything derives from the canonical route
// registry (lib/routes.ts) + the single pricing source (lib/pricing.ts).

// Panel 1 — Bundles: the five persona/Provenance bundle cards (label from the registry, note + price
// from the pricing source — no copy invented here) + marketplace on-ramps in the foot. Every card
// resolves its price from the bundle anchor; the /ai-kit route maps to the ai-production bundle id.
const BUNDLES_PANEL: NavPanelSpec = {
  label: "Bundles",
  lede: "One audited base. Six bundles — or compose your own.",
  cards: EDITION_ROUTES.map((r) => {
    const slug = r.path.slice(1);
    const bundleId = slug === "ai-kit" ? "ai-production" : slug;
    const anchor = isBundleId(bundleId) ? bundlePriceById(bundleId) : undefined;
    return {
      href: r.path,
      label: r.navLabel ?? r.label,
      note: anchor?.note ?? "",
      price: anchor ? formatPrice(anchor) : "—",
      // The bundle's bespoke waterline mark (ADR-0237 F6).
      icon: isBundleId(bundleId) ? BUNDLE_MARKS[bundleId] : "audit-chain",
    };
  }),
  foot: [
    {
      href: "/marketplace",
      label: "Compare the bundles",
      desc: "Side-by-side, plus the Everything bundle.",
    },
    {
      href: "/marketplace/build",
      label: "Build your stack",
      desc: "Compose your own stack, module by module.",
    },
  ],
};

// Panel 2 — Marketplace: the four hub tabs as cards (ADR-0237 F1), each with the F4 card grammar
// (icon + label + one-liner + price where the surface has one).
const MARKETPLACE_PANEL: NavPanelSpec = {
  label: "Marketplace",
  lede: "Buy a module, a bundle, or everything.",
  cards: [
    {
      href: "/marketplace",
      label: "Bundles",
      note: "Compare the six bundles side by side.",
      price: `from ${formatUsd(BUNDLE_MIN)}`,
      icon: "caisson",
    },
    {
      href: "/marketplace/modules",
      label: "Modules",
      note: "Every standalone module, à la carte.",
      price: planPrice("module"),
      icon: "boxes",
    },
    {
      href: "/marketplace/build",
      label: "Build your stack",
      note: "Compose module by module, live total.",
      icon: "terminal",
    },
    {
      href: "/marketplace/plans",
      label: "Plans",
      note: "Subscriptions that keep it current.",
      price: `from ${planPrice("developer")}`,
      icon: "plan-tier",
    },
  ],
};

// Panel 3 — Resources (ADR-0237 F4): Docs · Glossary · Changelog · Security. No prices.
const RESOURCES_PANEL: NavPanelSpec = {
  label: "Resources",
  cards: [
    {
      href: "/docs",
      label: "Docs",
      note: "Install, compose, and ship the substrate.",
      icon: "book",
    },
    {
      href: "/glossary",
      label: "Glossary",
      note: "The compliance-engineering terms, defined against real code.",
      icon: "file-check",
    },
    {
      href: "/changelog",
      label: "Changelog",
      note: "What shipped, release by release.",
      icon: "git-branch",
    },
    {
      href: "/security",
      label: "Security",
      note: "Disclosure policy and the shipped controls.",
      icon: "shield",
    },
  ],
};

const PANELS: readonly NavPanelSpec[] = [
  BUNDLES_PANEL,
  MARKETPLACE_PANEL,
  RESOURCES_PANEL,
];

// The mobile drawer lists every destination flat (no disclosure): the bundle personas, the four
// marketplace tabs, then the resource surfaces.
const MOBILE_LINKS: readonly { href: string; label: string }[] = [
  ...EDITION_ROUTES.map((r) => ({
    href: r.path,
    label: r.navLabel ?? r.label,
  })),
  { href: "/marketplace", label: "Marketplace" },
  { href: "/marketplace/modules", label: "Modules" },
  { href: "/marketplace/build", label: "Build your stack" },
  { href: "/marketplace/plans", label: "Plans" },
  { href: "/docs", label: "Docs" },
  { href: "/glossary", label: "Glossary" },
];

// Primary CTA destination — "Get started" points at the getting-started guide (label matches
// destination). The buy path already has three affordances: the panels, the Marketplace link,
// and the always-visible cart.
const GET_STARTED = { href: "/docs/getting-started", label: "Get started" };

export function SiteNav() {
  return (
    <header className="cs-nav">
      <Link href="/" className="cs-brand" aria-label="Caisson home">
        <Wordmark />
      </Link>

      {/* Centered trigger row — the three card panels. Hidden below 900px (the drawer takes
          over). */}
      <div className={styles.navCenter}>
        <NavPanels panels={PANELS} />
      </div>

      {/* Right utility cluster (F3): search · cart · Get started · theme. The cart stays visible
          below 900px too (rendered again inside the compact cluster, not gated). */}
      <div className={styles.navUtils}>
        <NavSearchTrigger />
        <CartTrigger />
        <Button href={GET_STARTED.href}>{GET_STARTED.label}</Button>
        <ThemeToggle />
      </div>

      {/* Compact cluster below 900px: cart + hamburger (the drawer carries search + CTA). */}
      <div className={styles.navCompact}>
        <CartTrigger />
        <MobileNav
          links={MOBILE_LINKS}
          cta={GET_STARTED}
          search={<NavSearchTrigger />}
        />
      </div>
    </header>
  );
}
