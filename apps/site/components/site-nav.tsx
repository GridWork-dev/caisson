"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle, Wordmark } from "@caisson/ui/components";

import { MobileNav } from "./mobile-nav";
import { Button } from "./button";
import { NAV_ROUTES } from "@/lib/routes";
import styles from "./site-nav.module.css";

// Marketing nav links derive from the canonical registry (lib/routes.ts); `/agentic-dev`'s absence
// is now expressed as `nav: false` there, not a magic omission. Docs is a documentation surface, not
// a marketing route, so it is appended explicitly.
const NAV_LINKS: readonly { href: string; label: string }[] = [
  ...NAV_ROUTES.map((r) => ({ href: r.path, label: r.navLabel ?? r.label })),
  { href: "/docs", label: "Docs" },
];

export function SiteNav() {
  const pathname = usePathname();
  return (
    <header className="cs-nav">
      <Link href="/" className="cs-brand" aria-label="Caisson home">
        <Wordmark />
      </Link>

      {/* Desktop link row — hidden below 680 px via global.css */}
      <nav className="cs-nav-links" aria-label="Primary">
        {NAV_LINKS.map((l) => {
          const active = pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>

      {/* Desktop CTA group — primary "Get started" → /pricing + theme toggle. Docs lives in the link row
          above (and the mobile drawer), so no duplicate ghost Docs button here. */}
      <div className={styles.navCtas}>
        <Button href="/pricing">Get started</Button>
        <ThemeToggle />
      </div>

      {/* Mobile hamburger + drawer (display:none above 680 px via global.css). Live self-serve
          posture (ADR-0082): the global CTA drives to /pricing, not a waitlist. */}
      <MobileNav
        links={NAV_LINKS}
        cta={{ href: "/pricing", label: "Get started" }}
      />
    </header>
  );
}
