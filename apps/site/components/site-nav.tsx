import Link from "next/link";

import { ThemeToggle, Wordmark } from "@caisson/ui/components";

import { CartTrigger } from "./cart-trigger";
import { MobileNav } from "./mobile-nav";
import { NavLinks } from "./nav-links";
import { Button } from "./button";
import { NAV_ROUTES } from "@/lib/routes";
import styles from "./site-nav.module.css";

// Server component (kickoff Phase-2). The shell — brand lockup, CTA group, layout — renders as RSC;
// only the active-link row (NavLinks), the theme toggle, and the mobile drawer ship as client
// islands. Marketing nav links derive from the canonical registry (lib/routes.ts); `/agentic-dev`'s
// absence is `nav: false` there, not a magic omission. Docs is a documentation surface, not a
// marketing route, so it is appended explicitly.
const NAV_LINKS: readonly { href: string; label: string }[] = [
  ...NAV_ROUTES.map((r) => ({ href: r.path, label: r.navLabel ?? r.label })),
  { href: "/docs", label: "Docs" },
];

export function SiteNav() {
  return (
    <header className="cs-nav">
      <Link href="/" className="cs-brand" aria-label="Caisson home">
        <Wordmark />
      </Link>

      {/* Desktop link row — hidden below 900px via global.css; active-link state is the one client island */}
      <NavLinks links={NAV_LINKS} />

      {/* Cart trigger — always visible (not gated by the 900px desktop/mobile split below), so it
          reads the same in the compact header and the full desktop bar. */}
      <CartTrigger />

      {/* Desktop CTA group — primary "Get started" → /pricing + theme toggle. Docs lives in the link row
          above (and the mobile drawer), so no duplicate ghost Docs button here. */}
      <div className={styles.navCtas}>
        <Button href="/pricing">Get started</Button>
        <ThemeToggle />
      </div>

      {/* Mobile hamburger + drawer (display:none above 900px via global.css). Live self-serve
          posture (ADR-0082): the global CTA drives to /pricing, not a waitlist. */}
      <MobileNav
        links={NAV_LINKS}
        cta={{ href: "/pricing", label: "Get started" }}
      />
    </header>
  );
}
