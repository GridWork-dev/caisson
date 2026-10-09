import Link from "next/link";

import { ThemeToggle } from "@caisson-sh/ui/components";
import { Wordmark } from "@caisson-sh/brand";

import { MobileNav } from "./mobile-nav";
import type { MobileNavItem, MobileNavSection } from "./mobile-drawer";
import { NavPanels, type NavCard, type NavPanelSpec } from "./nav-panels";
import { NavSearchTrigger } from "./nav-search-trigger";
import { Button } from "./button";
import { type IconName } from "@caisson-sh/ui/components";
import { BUNDLE_MARKS } from "@/lib/marks";
import { bundleById, isBundleId } from "@/lib/catalog";
import { BUNDLE_ROUTES } from "@/lib/routes";
import styles from "./site-nav.module.css";

// Server component. ADR-0237 F3 arrangement: logo left → CENTERED trigger row (the two card
// panels, Marketplace / Resources) + search → right utility cluster (theme · Get started). The
// shell renders as RSC; the panel duo (NavPanels), the search island, the theme toggle, and the
// mobile drawer ship as client islands. Everything derives from the canonical route registry
// (lib/routes.ts) + the module catalog (lib/catalog.ts).

// The Marketplace panel carries two card groups under one trigger: "Module families" — the five
// module-family cards plus the whole-catalog Everything composition — and "Marketplace" — the
// demonstration gallery and the UI showcase. The /ai-kit route maps to the ai-production id.
const MARKETPLACE_PANEL: NavPanelSpec = {
  label: "Marketplace",
  lede: "One audited base. Five module families, with live demos.",
  groups: [
    {
      heading: "Module families",
      cards: [
        ...BUNDLE_ROUTES.map((r) => {
          const slug = r.path.slice(1);
          const bundleId = slug === "ai-kit" ? "ai-production" : slug;
          return {
            href: r.path,
            label: r.navLabel ?? r.label,
            note: isBundleId(bundleId)
              ? (bundleById(bundleId)?.note ?? "")
              : "",
            // The family's bespoke waterline mark (ADR-0237 F6).
            icon: isBundleId(bundleId) ? BUNDLE_MARKS[bundleId] : "audit-chain",
          };
        }),
        {
          href: "/marketplace?view=bundle:everything",
          label: "Everything",
          note: bundleById("everything")?.note ?? "",
          icon: BUNDLE_MARKS.everything,
        },
      ],
    },
    {
      heading: "Marketplace",
      cards: [
        {
          href: "/marketplace",
          label: "Marketplace",
          note: "Every module family and module on one surface, each with a live demo.",
          icon: "bundle",
        },
        {
          href: "/ui",
          label: "UI Pro showcase",
          note: "The extended component layer, live.",
          icon: "dashboard",
        },
      ],
    },
  ],
};

// Panel 2 — Resources (ADR-0237 F4): Docs · Updates · Security · Evidence.
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
// can never drift. A panel with `groups` yields one section per group (Module families /
// Marketplace); a flat-`cards` panel yields one section under its own label (Resources).
const SECTION_ICON: Record<string, IconName> = {
  "Module families": "bundle",
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
// destination).
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

      {/* Right utility cluster (F3): theme · Get started. ADR-0374: the header nav is a persistent
          utility row on EVERY page, never the page's own primary action, so its CTA reads as
          `ghost` and leaves each page's real primary CTA the only solid-accent button in view.
          The mobile drawer's own pinned CTA (Kickoff-I) is a separate, explicit
          `variant="primary"` call in mobile-drawer.tsx. */}
      <div className={styles.navUtils}>
        <ThemeToggle />
        <Button href={GET_STARTED.href} variant="ghost">
          {GET_STARTED.label}
        </Button>
      </div>

      {/* Compact cluster below 900px: the hamburger. The drawer carries its own search and CTA in a
          pinned top block (ADR-0312). */}
      <div className={styles.navCompact}>
        <MobileNav sections={MOBILE_SECTIONS} cta={GET_STARTED} />
      </div>
    </header>
  );
}
