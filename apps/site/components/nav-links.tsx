"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The desktop primary-nav link row — the ONLY part of SiteNav that needs the client (it reads
// usePathname for the active-link aria-current). Extracted so SiteNav itself is a server component
// (kickoff Phase-2: "SiteNav → RSC + tiny active-link island"). Hidden below 900px via global.css;
// the mobile drawer (MobileNav) carries its own active-link state.
export function NavLinks({
  links,
}: {
  links: readonly { href: string; label: string }[];
}) {
  const pathname = usePathname();
  return (
    <nav className="cs-nav-links" aria-label="Primary">
      {links.map((l) => {
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
  );
}
