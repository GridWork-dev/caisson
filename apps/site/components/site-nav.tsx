"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "./theme-toggle";

const LINKS = [
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
        <span className="mark">caisson</span>
      </Link>
      <nav className="cs-nav-links" aria-label="Primary">
        {LINKS.map((l) => {
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
      <ThemeToggle />
    </header>
  );
}
