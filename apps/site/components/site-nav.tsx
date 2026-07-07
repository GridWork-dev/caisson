import Link from "next/link";

import { ThemeToggle } from "@caisson/ui/components";
import { Wordmark } from "@caisson/brand";

import { CartTrigger } from "./cart-trigger";
import { MobileNav } from "./mobile-nav";
import { NavAccount } from "./nav-account";
import { NavPanels, type NavPanelSpec } from "./nav-panels";
import { NavSearchTrigger } from "./nav-search-trigger";
import { Button } from "./button";
import { BUNDLE_MARKS } from "@/lib/marks";
import {
  bundlePriceById,
  formatPrice,
  isBundleId,
  planPrice,
} from "@/lib/pricing";
import { EDITION_ROUTES } from "@/lib/routes";
import styles from "./site-nav.module.css";

// Server component. ADR-0237 F3 arrangement: logo left → CENTERED trigger row (the two card
// panels, Marketplace / Resources) + search → right utility cluster (cart · theme · Get started ·
// account). The shell renders as RSC; the panel duo (NavPanels), the search/account islands, the
// theme toggle, and the mobile drawer ship as client islands. Everything derives from the
// canonical route registry (lib/routes.ts) + the single pricing source (lib/pricing.ts).

// The Marketplace panel carries two card groups under one trigger: "Bundles" — the five
// persona/Provenance bundle cards plus the whole-catalog Everything bundle — and "Marketplace" —
// the remaining hub tabs (Modules, Build your stack, Plans). Every card resolves its price from
// the bundle/plan anchor — no copy invented here. The /ai-kit route maps to the ai-production
// bundle id.
const MARKETPLACE_PANEL: NavPanelSpec = {
  label: "Marketplace",
  lede: "One audited base. Six bundles, à la carte modules, or a stack you compose yourself.",
  groups: [
    {
      heading: "Bundles",
      cards: [
        ...EDITION_ROUTES.map((r) => {
          const slug = r.path.slice(1);
          const bundleId = slug === "ai-kit" ? "ai-production" : slug;
          const anchor = isBundleId(bundleId)
            ? bundlePriceById(bundleId)
            : undefined;
          return {
            href: r.path,
            label: r.navLabel ?? r.label,
            note: anchor?.note ?? "",
            price: anchor ? formatPrice(anchor) : "—",
            // The bundle's bespoke waterline mark (ADR-0237 F6).
            icon: isBundleId(bundleId) ? BUNDLE_MARKS[bundleId] : "audit-chain",
          };
        }),
        (() => {
          const everything = bundlePriceById("everything");
          return {
            href: "/marketplace#everything",
            label: "Everything",
            note: everything?.note ?? "",
            price: everything ? formatPrice(everything) : "—",
            icon: BUNDLE_MARKS.everything,
          };
        })(),
      ],
    },
    {
      heading: "Marketplace",
      cards: [
        {
          href: "/marketplace",
          label: "Marketplace",
          note: "The whole catalog — bundles and modules.",
          icon: "bundle",
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
        {
          href: "/compare",
          label: "Compare",
          note: "Bundles and modules, side by side.",
          icon: "scale",
        },
        {
          href: "/ui",
          label: "UI Pro showcase",
          note: "The premium component layer, live.",
          icon: "dashboard",
        },
      ],
    },
  ],
};

// Panel 2 — Resources (ADR-0237 F4): Docs · Glossary · Updates · Security. No prices.
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
      href: "/updates",
      label: "Updates",
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

const PANELS: readonly NavPanelSpec[] = [MARKETPLACE_PANEL, RESOURCES_PANEL];

// The mobile drawer lists every destination flat (no disclosure): the bundle personas + Everything,
// the marketplace tabs, then the resource surfaces — mirrors the merged Marketplace panel's groups.
const MOBILE_LINKS: readonly { href: string; label: string }[] = [
  ...EDITION_ROUTES.map((r) => ({
    href: r.path,
    label: r.navLabel ?? r.label,
  })),
  { href: "/marketplace#everything", label: "Everything" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/marketplace/modules", label: "Modules" },
  { href: "/marketplace/build", label: "Build your stack" },
  { href: "/marketplace/plans", label: "Plans" },
  { href: "/compare", label: "Compare" },
  { href: "/ui", label: "UI Pro showcase" },
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

      {/* Centered trigger row — the two card panels + search. Hidden below 900px (the drawer
          takes over). */}
      <div className={styles.navCenter}>
        <NavPanels panels={PANELS} />
        <NavSearchTrigger />
      </div>

      {/* Right utility cluster (F3): cart · theme · Get started · account. The cart stays visible
          below 900px too (rendered again inside the compact cluster, not gated). */}
      <div className={styles.navUtils}>
        <CartTrigger />
        <ThemeToggle />
        <Button href={GET_STARTED.href}>{GET_STARTED.label}</Button>
        <NavAccount />
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
