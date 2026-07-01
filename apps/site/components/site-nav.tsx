import Link from "next/link";

import { ThemeToggle, Wordmark } from "@caisson/ui/components";

import { CartTrigger } from "./cart-trigger";
import { EditionsMenu, type EditionMenuItem } from "./editions-menu";
import { MobileNav } from "./mobile-nav";
import { NavLinks } from "./nav-links";
import { NavSearchTrigger } from "./nav-search-trigger";
import { Button } from "./button";
import { editionPrice, priceById } from "@/lib/pricing";
import { EDITION_ROUTES, NAV_ROUTES } from "@/lib/routes";
import styles from "./site-nav.module.css";

// Server component (kickoff Phase-2). The shell — brand lockup, CTA group, layout — renders as RSC;
// only the active-link row (NavLinks), the editions disclosure (EditionsMenu), the theme toggle, and
// the mobile drawer ship as client islands. Everything derives from the canonical route registry
// (lib/routes.ts) + the single pricing source (lib/pricing.ts).

// The four editions, folded behind the "Editions" disclosure (D-2, ADR-0190). Label from the route
// registry, one-line note + starting price from the single pricing source — no copy invented here.
const EDITION_MENU: readonly EditionMenuItem[] = EDITION_ROUTES.map((r) => {
  const slug = r.path.slice(1);
  return {
    href: r.path,
    label: r.navLabel ?? r.label,
    note: priceById(slug)?.note ?? "",
    price: editionPrice(slug),
  };
});

// Flat desktop links beside the disclosure — the non-edition nav routes (Pricing) plus Docs (a
// documentation surface, not a marketing route, so appended explicitly).
const FLAT_LINKS: readonly { href: string; label: string }[] = [
  ...NAV_ROUTES.filter((r) => r.group !== "edition").map((r) => ({
    href: r.path,
    label: r.navLabel ?? r.label,
  })),
  { href: "/docs", label: "Docs" },
];

// The mobile drawer has room to list every destination flat (no disclosure): the four editions, the
// three marketplace/pricing surfaces, then Docs.
const MOBILE_LINKS: readonly { href: string; label: string }[] = [
  ...EDITION_ROUTES.map((r) => ({
    href: r.path,
    label: r.navLabel ?? r.label,
  })),
  { href: "/pricing", label: "Pricing" },
  { href: "/modules", label: "Modules" },
  { href: "/build", label: "Build your stack" },
  { href: "/docs", label: "Docs" },
];

// Primary CTA destination — "Get started" points at the getting-started guide (label matches
// destination). The buy path already has three affordances: the Editions disclosure, the Pricing
// link, and the always-visible cart.
const GET_STARTED = { href: "/docs/getting-started", label: "Get started" };

export function SiteNav() {
  return (
    <header className="cs-nav">
      <Link href="/" className="cs-brand" aria-label="Caisson home">
        <Wordmark />
      </Link>

      {/* Desktop nav cluster — the editions disclosure + the flat link row. Hidden below 900px (the
          drawer takes over); EditionsMenu sits outside `.cs-nav-links` so its panel links don't
          inherit that row's muted link colour. */}
      <div className={styles.navCluster}>
        <EditionsMenu editions={EDITION_MENU} />
        <NavLinks links={FLAT_LINKS} />
      </div>

      {/* Cart trigger — always visible (not gated by the 900px desktop/mobile split below), so it
          reads the same in the compact header and the full desktop bar. */}
      <CartTrigger />

      {/* Desktop CTA group — search, primary "Get started", theme toggle. */}
      <div className={styles.navCtas}>
        <NavSearchTrigger />
        <Button href={GET_STARTED.href}>{GET_STARTED.label}</Button>
        <ThemeToggle />
      </div>

      {/* Mobile hamburger + drawer (display:none above 900px via global.css). */}
      <MobileNav
        links={MOBILE_LINKS}
        cta={GET_STARTED}
        search={<NavSearchTrigger />}
      />
    </header>
  );
}
