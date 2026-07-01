"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@caisson/ui/components";

// Top-level control-plane sections. Only surfaces that exist are linked; Ops / Business /
// Architecture / Decisions land their nav entries as tasks A4-A7 build them (a nav entry to a
// route that doesn't exist yet is a dead link, not a scaffold).
const LINKS = [
  { href: "/", label: "Overview" },
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
