"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { Icon, type IconName } from "@/components";
import { trackEvent } from "@/lib/analytics";
import styles from "./nav-panels.module.css";

// The centered primary-nav trigger row (ADR-0237 F3/F4): three card-panel disclosures —
// Editions / Marketplace / Resources — generalizing the single ADR-0190 EditionsMenu. Each panel
// is a WAI-ARIA Disclosure (NOT role=menu): ordinary links a screen reader reads as a list, Tab
// moves naturally. One client island owns which panel is open (at most one), the Esc/outside-click
// contract, and route-change close. Panels are card-sized and left-anchored under their trigger —
// never a viewport-spanning mega-menu (design brief; ADR-0190's cliché rejection stands).

export interface NavCard {
  href: string;
  label: string;
  note: string;
  /** Committed display price ("$1,049", "from $49") — only on commerce cards (ADR-0237 F4). */
  price?: string;
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
                {c.price && <span className={styles.cardPrice}>{c.price}</span>}
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
  const baseId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const pathname = usePathname();

  // Close when the route changes (a panel link was followed).
  useEffect(() => setOpenIndex(null), [pathname]);

  // Disclosure contract: Esc closes and returns focus to the open trigger; a pointer outside the
  // whole row closes without stealing focus. No focus trap — disclosures, not modals.
  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        triggerRefs.current[openIndex]?.focus();
        setOpenIndex(null);
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpenIndex(null);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [openIndex]);

  return (
    <div className={styles.row} ref={wrapRef}>
      {panels.map((panel, i) => {
        const open = openIndex === i;
        const panelId = `${baseId}-panel-${i}`;
        const allCards =
          panel.cards ?? panel.groups?.flatMap((g) => g.cards) ?? [];
        const onSurface = allCards.some((c) => pathname.startsWith(c.href));
        return (
          <div key={panel.label} className={styles.wrap}>
            <button
              ref={(el) => {
                triggerRefs.current[i] = el;
              }}
              type="button"
              className={styles.trigger}
              aria-expanded={open}
              aria-controls={panelId}
              aria-current={onSurface ? "page" : undefined}
              onClick={() => {
                setOpenIndex(open ? null : i);
                // Nav engagement (ADR-0237 F8) — opens only, never the close of the same panel.
                if (!open) trackEvent("nav_panel_open", { panel: panel.label });
              }}
            >
              {panel.label}
              <Chevron />
            </button>

            {/* Kept in the DOM so aria-controls resolves; `hidden` drops it from the a11y tree +
                tab order when closed. */}
            <div
              id={panelId}
              className={styles.panel}
              hidden={!open}
              style={
                panel.groups
                  ? {
                      maxHeight: "calc(100vh - 6rem)",
                      overflowY: "auto",
                      width: "min(40rem, 92vw)",
                    }
                  : undefined
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
                      <p
                        className={styles.lede}
                        style={{ fontWeight: "var(--cs-weight-semibold)" }}
                      >
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
                    <Link
                      key={f.href}
                      href={f.href}
                      className={styles.footLink}
                    >
                      <span className={styles.footLabel}>{f.label} →</span>
                      <span className={styles.footDesc}>{f.desc}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
