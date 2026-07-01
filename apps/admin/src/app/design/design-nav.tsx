"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@caisson/ui/components";

// The design-section sub-nav (the absorbed studio's topbar), rendered under the root AdminNav by
// design/layout.tsx. Signature is intentionally absent — the four-beat sketches are deferred (the
// only deferred surface); the route still exists but is unlinked until the direction is reworked.
const LINKS = [
  { href: "/design", label: "Overview" },
  { href: "/design/foundations", label: "Foundations" },
  { href: "/design/typography", label: "Typography" },
  { href: "/design/wordmark", label: "Wordmark" },
  { href: "/design/components", label: "Components" },
] as const;

export function DesignNav() {
  const pathname = usePathname();
  return (
    <header className="topbar">
      <div className="row" style={{ gap: "1.5rem" }}>
        <Link
          href="/design"
          className="brand"
          aria-label="Caisson Design System"
        >
          <span className="mark">caisson</span>
          <span className="sub">/ design</span>
        </Link>
        <nav className="nav" aria-label="Design sections">
          {LINKS.map((l) => {
            const active =
              l.href === "/design"
                ? pathname === "/design"
                : pathname.startsWith(l.href);
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
      </div>
      <ThemeToggle />
    </header>
  );
}
