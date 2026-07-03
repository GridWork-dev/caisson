import Link from "next/link";

import { ThemeToggle, Wordmark } from "@caisson/ui/components";

import { CartTrigger } from "./cart-trigger";
import { MobileNav } from "./mobile-nav";
import { NavPanels, type NavPanelSpec } from "./nav-panels";
import { NavSearchTrigger } from "./nav-search-trigger";
import { Button } from "./button";
import { EDITION_MARKS } from "@/lib/marks";
import {
  EDITION_PRICES,
  editionPrice,
  formatUsd,
  isEditionId,
  priceById,
} from "@/lib/pricing";

// Cheapest edition — computed, never hand-duplicated (the "from $X" anchor on the Editions card).
const EDITION_MIN = Math.min(
  ...EDITION_PRICES.map((p) => p.amount ?? Infinity),
);
import { EDITION_ROUTES } from "@/lib/routes";
import styles from "./site-nav.module.css";

// Server component. ADR-0237 F3 arrangement: logo left → CENTERED trigger row (the three F4
// card panels: Editions / Marketplace / Resources) → right utility cluster (search · cart ·
// Get started · theme). The shell renders as RSC; the panel trio (NavPanels), the theme toggle,
// and the mobile drawer ship as client islands. Everything derives from the canonical route
// registry (lib/routes.ts) + the single pricing source (lib/pricing.ts).

// Panel 1 — Editions: the four edition cards (label from the registry, note + price from the
// pricing source — no copy invented here) + marketplace on-ramps in the foot.
const EDITIONS_PANEL: NavPanelSpec = {
  label: "Editions",
  lede: "One audited base. Four editions — or compose your own.",
  cards: EDITION_ROUTES.map((r) => {
    const slug = r.path.slice(1);
    return {
      href: r.path,
      label: r.navLabel ?? r.label,
      note: priceById(slug)?.note ?? "",
      price: editionPrice(slug),
      // The edition's bespoke waterline mark (ADR-0237 F6).
      ...(isEditionId(slug) ? { icon: EDITION_MARKS[slug] } : {}),
    };
  }),
  foot: [
    {
      href: "/marketplace",
      label: "Compare editions & bundle",
      desc: "Side-by-side, plus the Everything bundle.",
    },
    {
      href: "/marketplace/build",
      label: "Build your stack",
      desc: "Compose your own edition, module by module.",
    },
  ],
};

// Panel 2 — Marketplace: the four hub tabs as cards (ADR-0237 F1), each with the F4 card grammar
// (icon + label + one-liner + price where the surface has one).
const MARKETPLACE_PANEL: NavPanelSpec = {
  label: "Marketplace",
  lede: "Buy a module, an edition, or everything.",
  cards: [
    {
      href: "/marketplace",
      label: "Editions",
      note: "Compare the four editions and the bundle.",
      price: `from ${formatUsd(EDITION_MIN)}`,
      icon: "caisson",
    },
    {
      href: "/marketplace/modules",
      label: "Modules",
      note: "Every standalone module, à la carte.",
      price: editionPrice("module"),
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
      price: `from ${editionPrice("developer")}`,
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
  EDITIONS_PANEL,
  MARKETPLACE_PANEL,
  RESOURCES_PANEL,
];

// The mobile drawer lists every destination flat (no disclosure): the four editions, the four
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
