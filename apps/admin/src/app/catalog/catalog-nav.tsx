"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@caisson/ui/components";

// The catalog-section sub-nav (the absorbed design studio's topbar, extended with the live
// component + email catalog), rendered under the root AdminNav by catalog/layout.tsx. Signature is
// intentionally absent — the four-beat sketches are deferred (the only deferred surface); the route
// still exists but is unlinked until the direction is reworked.
const LINKS = [
  { href: "/catalog", label: "Overview" },
  { href: "/catalog/foundations", label: "Foundations" },
  { href: "/catalog/typography", label: "Typography" },
  { href: "/catalog/wordmark", label: "Wordmark" },
  { href: "/catalog/components", label: "Components" },
  { href: "/catalog/emails", label: "Emails" },
] as const;

export function CatalogNav() {
  const pathname = usePathname();
  return (
    <header className="topbar">
      <div className="row" style={{ gap: "1.5rem" }}>
        <Link href="/catalog" className="brand" aria-label="Caisson Catalog">
          <span className="mark">caisson</span>
          <span className="sub">/ catalog</span>
        </Link>
        <nav className="nav" aria-label="Catalog sections">
          {LINKS.map((l) => {
            const active =
              l.href === "/catalog"
                ? pathname === "/catalog"
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
