"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@caisson/ui/components";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/design/foundations", label: "Foundations" },
  { href: "/design/typography", label: "Typography" },
  { href: "/design/signature", label: "Signature" },
  { href: "/components", label: "Components" },
] as const;

export function Topbar() {
  const pathname = usePathname();
  return (
    <header className="topbar">
      <div className="row" style={{ gap: "1.5rem" }}>
        <Link href="/" className="brand" aria-label="Caisson Design Studio">
          <span className="mark">caisson</span>
          <span className="sub">/ studio</span>
        </Link>
        <nav className="nav" aria-label="Studio sections">
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
