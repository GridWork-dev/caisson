"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { MARKETPLACE_TAB_ROUTES } from "@/lib/routes";
import styles from "./marketplace-tabs.module.css";

// The /marketplace hub tab bar (ADR-0237 F1): four URL-addressable tabs derived from the route
// registry. These are LINKS to sibling pages, not a same-page tab widget, so the correct a11y
// shape is a nav landmark with aria-current="page" — role=tablist would promise arrow-key
// same-page switching the pattern doesn't have (WCAG 2.2 AA floor, ADR-0194).
export function MarketplaceTabs() {
  const pathname = usePathname();
  return (
    <div className={styles.scrollFade}>
      <nav aria-label="Marketplace sections" className={styles.tabs}>
        {MARKETPLACE_TAB_ROUTES.map((r) => {
          // The hub root is the Editions tab; deeper tabs match on their own path.
          const active =
            r.path === "/marketplace"
              ? pathname === "/marketplace"
              : pathname.startsWith(r.path);
          const label = r.path === "/marketplace" ? "Editions" : r.label;
          return (
            <Link
              key={r.path}
              href={r.path}
              className={styles.tab}
              aria-current={active ? "page" : undefined}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
