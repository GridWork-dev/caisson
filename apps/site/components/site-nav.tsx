import Link from "next/link";

import { ThemeToggle } from "@caisson/ui/components";
import { Wordmark } from "@caisson/brand";

import { CartTrigger } from "./cart-trigger";
import { MobileNav } from "./mobile-nav";
import type { MobileNavItem, MobileNavSection } from "./mobile-drawer";
import { NavAccount } from "./nav-account";
import { NavPanels, type NavCard, type NavPanelSpec } from "./nav-panels";
import { NavSearchTrigger } from "./nav-search-trigger";
import { Button } from "./button";
import { type IconName } from "@caisson/ui/components";
import { BUNDLE_MARKS } from "@/lib/marks";
import {
  bundlePriceById,
  formatPrice,
  isBundleId,
  planPrice,
} from "@/lib/pricing";
import { BUNDLE_ROUTES } from "@/lib/routes";
import styles from "./site-nav.module.css";

// Server component. ADR-0237 F3 arrangement: logo left → CENTERED trigger row (the two card
// panels, Marketplace / Resources) + search → right utility cluster (cart · theme · Get started ·
// account). The shell renders as RSC; the panel duo (NavPanels), the search/account islands, the
// theme toggle, and the mobile drawer ship as client islands. Everything derives from the
// canonical route registry (lib/routes.ts) + the single pricing source (lib/pricing.ts).

// The Marketplace panel carries two card groups under one trigger: "Bundles" — the five
// persona/Provenance bundle cards plus the whole-catalog Everything bundle — and "Marketplace" —
// the one unified surface, Plans, and the periphery (Compare, Stack fit, UI Pro). The former
// Modules + Build tabs folded into the surface (ADR-0285). Every card resolves its price from the
// bundle/plan anchor — no copy invented here. The /ai-kit route maps to the ai-production bundle id.
const MARKETPLACE_PANEL: NavPanelSpec = {
  label: "Marketplace",
  lede: "One audited base. Six bundles, à la carte modules, or a stack you compose yourself.",
  groups: [
    {
      heading: "Bundles",
      cards: [
        ...BUNDLE_ROUTES.map((r) => {
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
            href: "/marketplace?view=bundle:everything",
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
          note: "Every bundle and module on one surface — filter, compare, build a stack.",
          price: planPrice("module"),
          icon: "bundle",
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
          note: "Caisson vs the alternatives — competitor comparisons, side by side.",
          icon: "scale",
        },
        {
          href: "/stack-fit",
          label: "Stack fit",
          note: "Does it fit your stack — the honest adapter matrix.",
          icon: "server",
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

// Panel 2 — Resources (ADR-0237 F4): Docs · Glossary · Updates · Security · Evidence. No prices.
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
    {
      href: "/evidence",
      label: "Evidence pack",
      note: "The shipped proof artifacts, for your security reviewer.",
      icon: "evidence-pack",
    },
  ],
};

const PANELS: readonly NavPanelSpec[] = [MARKETPLACE_PANEL, RESOURCES_PANEL];

// The mobile drawer's accordion sections (ADR-0312) are DERIVED from the same panel spec as the
// desktop dropdowns — one card group becomes one collapsed <details> section — so the two surfaces
// can never drift. A panel with `groups` yields one section per group (Bundles / Marketplace); a
// flat-`cards` panel yields one section under its own label (Resources).
const SECTION_ICON: Record<string, IconName> = {
  Bundles: "bundle",
  Marketplace: "boxes",
  Resources: "book",
};

function toMobileItem(c: NavCard): MobileNavItem {
  return { href: c.href, label: c.label, icon: c.icon ?? "boxes" };
}

const MOBILE_SECTIONS: readonly MobileNavSection[] = PANELS.flatMap((p) =>
  p.groups
    ? p.groups.map((g) => ({
        group: g.heading,
        icon: SECTION_ICON[g.heading] ?? "boxes",
        items: g.cards.map(toMobileItem),
      }))
    : [
        {
          group: p.label,
          icon: SECTION_ICON[p.label] ?? "boxes",
          items: (p.cards ?? []).map(toMobileItem),
        },
      ],
);

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
          below 900px too (rendered again inside the compact cluster, not gated).
          ADR-0374 (13d3ad90bd9d5c1d/6fb94e97aa492d63): this was `variant="primary"` (solid accent) —
          on any page whose own content leads with a solid-accent CTA (e.g. the empty /cart card's
          "Browse editions & modules"), two competing solid buttons shared the fold. The header nav
          is a persistent utility row on EVERY page, never the page's own primary action, so it
          reads as `ghost` everywhere — matching NavAccount's bordered "Sign in" pill beside it — and
          leaves each page's real primary CTA the only solid-accent button in view. The mobile
          drawer's own pinned CTA (Kickoff-I) is a separate, explicit `variant="primary"` call in
          mobile-drawer.tsx and is unaffected. */}
      <div className={styles.navUtils}>
        <CartTrigger />
        <ThemeToggle />
        <Button href={GET_STARTED.href} variant="ghost">
          {GET_STARTED.label}
        </Button>
        <NavAccount />
      </div>

      {/* Compact cluster below 900px: cart + hamburger. The drawer carries its own search, account,
          cart, and CTA in a pinned top block (ADR-0312). */}
      <div className={styles.navCompact}>
        <CartTrigger />
        <MobileNav sections={MOBILE_SECTIONS} cta={GET_STARTED} />
      </div>
    </header>
  );
}
