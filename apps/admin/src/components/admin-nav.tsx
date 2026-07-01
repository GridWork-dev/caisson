"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@caisson/ui/components";

// Top-level control-plane sections (ADR-0138): ops/observability, business admin, live
// architecture, the decisions SOT board, and the absorbed design system.
const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/ops", label: "Ops" },
  { href: "/business", label: "Business" },
  { href: "/architecture", label: "Architecture" },
  { href: "/decisions", label: "Decisions" },
  { href: "/design", label: "Design" },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <header className="topbar">
      <div className="row" style={{ gap: "1.5rem" }}>
        <Link href="/" className="brand" aria-label="Caisson Admin">
          <span className="mark">caisson</span>
          <span className="sub">/ admin</span>
        </Link>
        <nav className="nav" aria-label="Admin sections">
          {LINKS.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
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
