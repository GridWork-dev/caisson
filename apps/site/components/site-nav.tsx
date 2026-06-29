"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Wordmark } from "./brand";
import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "./button";
import styles from "./site-nav.module.css";

// Agentic-Dev is intentionally absent from the primary nav (roadmap edition, ADR-0082 §4).
const NAV_LINKS = [
  { href: "/compliance", label: "Compliance" },
  { href: "/ai-kit", label: "AI Production Kit" },
  { href: "/local-first", label: "Local-first" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
] as const;

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
