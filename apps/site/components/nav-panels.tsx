"use client";

import { Popover } from "@caisson/ui-pro/components";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Icon, type IconName } from "@/components";
import { trackEvent } from "@/lib/analytics";
import styles from "./nav-panels.module.css";

// The centered primary-nav trigger row (ADR-0237 F3/F4, repointed onto the kit `Popover` per
// ADR-0291): three card-panel disclosures — Editions / Marketplace / Resources — generalizing the
// single ADR-0190 EditionsMenu. Each panel is a WAI-ARIA Disclosure (NOT role=menu): ordinary
// links a screen reader reads as a list. Tab order is NOT natural — the panel is portaled to
// document.body, so `Popover` moves focus onto the panel on open and Tab proceeds from there into
// its links; every keyboard-initiated close returns focus to the trigger. `Popover` owns that
// whole disclosure contract (open-focus/Escape/outside-click/close-focus) per instance (audited
// once, shared — this file used to hand-roll that logic); this component only coordinates "at
// most one open" across the row and closes on route change. Panels are card-sized and
// left-anchored under their trigger — never a viewport-spanning mega-menu (design brief;
// ADR-0190's cliché rejection stands).

export interface NavCard {
  href: string;
  label: string;
  note: string;
  /** Icon name from the @caisson/ui set (bespoke marks land with wave 2). */
  icon?: IconName;
}

/** A named sub-list inside a panel (e.g. the merged Marketplace panel's "Bundles" / "Marketplace"
 *  groups) — used instead of a flat `cards` list when a panel has more than one card family. */
export interface NavCardGroup {
  heading: string;
  cards: readonly NavCard[];
}

export interface NavPanelSpec {
  label: string;
  lede?: string;
  /** A single flat card list, no sub-heading (e.g. Resources). Mutually exclusive with `groups`. */
  cards?: readonly NavCard[];
  /** Two or more headed card groups inside one panel (e.g. Marketplace's Bundles | Marketplace). */
  groups?: readonly NavCardGroup[];
  foot?: readonly { href: string; label: string; desc: string }[];
}

function CardList({
  cards,
  pathname,
}: {
  cards: readonly NavCard[];
  pathname: string;
}) {
  return (
    <ul className={styles.cards}>
      {cards.map((c) => (
        <li key={c.href}>
          <Link
            href={c.href}
            className={styles.card}
            aria-current={
              pathname === c.href ||
              (c.href !== "/" && pathname.startsWith(`${c.href}/`))
                ? "page"
                : undefined
            }
          >
            {c.icon && (
              <span className={styles.cardIcon} aria-hidden="true">
                <Icon name={c.icon} />
              </span>
            )}
            <span className={styles.cardBody}>
              <span className={styles.cardHead}>
                <span className={styles.cardName}>{c.label}</span>
              </span>
              <span className={styles.cardNote}>{c.note}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Chevron() {
  return (
    <svg
      className={styles.chev}
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function NavPanels({ panels }: { panels: readonly NavPanelSpec[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const pathname = usePathname();

  // Close when the route changes (a panel link was followed).
  useEffect(() => setOpenIndex(null), [pathname]);

  return (
    <div className={styles.row}>
      {panels.map((panel, i) => {
        const open = openIndex === i;
        const allCards =
          panel.cards ?? panel.groups?.flatMap((g) => g.cards) ?? [];
        // Same path-boundary predicate as CardList's aria-current: exact match or a true child
        // segment — a bare startsWith would light the trigger for sibling routes sharing a prefix.
        const onSurface = allCards.some(
          (c) =>
            pathname === c.href ||
            (c.href !== "/" && pathname.startsWith(`${c.href}/`)),
        );
        return (
          <Popover
            key={panel.label}
            trigger={
              <>
                {panel.label}
                <Chevron />
              </>
            }
            open={open}
            onOpenChange={(next) => {
              setOpenIndex(next ? i : null);
              // Nav engagement (ADR-0237 F8) — opens only, never the close of the same panel.
              if (next) trackEvent("nav_panel_open", { panel: panel.label });
            }}
            aria-current={onSurface ? "page" : undefined}
            className={styles.trigger}
            panelClassName={
              panel.groups
                ? `${styles.panel} ${styles.panelWide}`
                : styles.panel
            }
          >
            {panel.lede && <p className={styles.lede}>{panel.lede}</p>}
            {panel.cards && (
              <CardList cards={panel.cards} pathname={pathname} />
            )}
            {panel.groups && (
              <div className={styles.groups}>
                {panel.groups.map((g) => (
                  <div key={g.heading} className={styles.group}>
                    <p className={`${styles.lede} ${styles.groupHeading}`}>
                      {g.heading}
                    </p>
                    <CardList cards={g.cards} pathname={pathname} />
                  </div>
                ))}
              </div>
            )}
            {panel.foot && (
              <div className={styles.foot}>
                {panel.foot.map((f) => (
                  <Link key={f.href} href={f.href} className={styles.footLink}>
                    <span className={styles.footLabel}>{f.label} →</span>
                    <span className={styles.footDesc}>{f.desc}</span>
                  </Link>
                ))}
              </div>
            )}
          </Popover>
        );
      })}
    </div>
  );
}
