"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import styles from "./editions-menu.module.css";

// The desktop "Editions" nav dropdown (D-2, ADR-0190). A WAI-ARIA Disclosure — NOT a
// role=menu — so the panel is ordinary links a screen reader reads as a list, and Tab moves
// through them naturally. The four editions collapse behind one trigger (the flat nav was five
// sibling links deep); the panel is text + mono, editions differ by label + note + price, never
// colour (DESIGN.md §5). Client island: it owns open state + the Esc/outside-click contract.
export interface EditionMenuItem {
  href: string;
  label: string;
  note: string;
  price: string;
}

// Fixed panel foot — the marketplace on-ramps, so "compose your own" sits next to the four
// pre-built editions the way /modules + /build sit next to /pricing.
const FOOT_LINKS: readonly { href: string; label: string; desc: string }[] = [
  {
    href: "/build",
    label: "Build your stack",
    desc: "Compose your own edition, module by module.",
  },
  {
    href: "/modules",
    label: "Browse all modules",
    desc: "Every module, à la carte.",
  },
  {
    href: "/pricing",
    label: "Compare editions & bundle",
    desc: "Side-by-side, plus the Everything bundle.",
  },
];

export function EditionsMenu({
  editions,
}: {
  editions: readonly EditionMenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // Close when the route changes (a panel link was followed).
  useEffect(() => setOpen(false), [pathname]);

  // Disclosure contract: Esc closes and returns focus to the trigger; a pointer outside the
  // wrapper closes without stealing focus. No focus trap — it's a disclosure, not a modal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const onEdition = editions.some((e) => pathname.startsWith(e.href));

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        aria-current={onEdition ? "page" : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        Editions
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
      </button>

      {/* Rendered always (kept in the DOM so aria-controls resolves); `hidden` drops it from the
          a11y tree + tab order when closed. */}
      <div id={panelId} className={styles.panel} hidden={!open}>
        <p className={styles.lede}>
          One audited base. Four editions — or compose your own.
        </p>
        <ul className={styles.editions}>
          {editions.map((e) => (
            <li key={e.href}>
              <Link
                href={e.href}
                className={styles.edition}
                aria-current={pathname.startsWith(e.href) ? "page" : undefined}
              >
                <span className={styles.editionHead}>
                  <span className={styles.editionName}>{e.label}</span>
                  <span className={styles.editionPrice}>{e.price}</span>
                </span>
                <span className={styles.editionNote}>{e.note}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className={styles.foot}>
          {FOOT_LINKS.map((f) => (
            <Link key={f.href} href={f.href} className={styles.footLink}>
              <span className={styles.footLabel}>{f.label} →</span>
              <span className={styles.footDesc}>{f.desc}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
