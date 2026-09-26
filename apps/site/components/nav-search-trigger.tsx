"use client";

import { useSearchContext } from "fumadocs-ui/contexts/search";

import styles from "./nav-search-trigger.module.css";

// Visible search affordance for the marketing shell (D-9, ADR-0196). The ⌘K hotkey is already
// bound app-wide by fumadocs' SearchProvider (root layout wraps everything in RootProvider), and
// the docs search dialog is already mounted there — marketing pages just had no button to open it.
// This is that button: it calls setOpenSearch(true) on the same context the docs toggle uses.
// Secondary prominence (the editions disclosure is the primary nav act, D-2) — a compact pill with
// a ⌘K hint, not a full search box.
export function NavSearchTrigger() {
  const { enabled, setOpenSearch } = useSearchContext();
  if (!enabled) return null;

  return (
    <button
      type="button"
      className={styles.trigger}
      onClick={() => {
        setOpenSearch(true);
      }}
      aria-label="Search the docs"
    >
      <svg
        viewBox="0 0 24 24"
        width="15"
        height="15"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <span className={styles.label}>Search</span>
      {/* Decorative shortcut hint — the binding is fumadocs' global ⌘/Ctrl+K listener. */}
      <kbd className={styles.kbd} aria-hidden="true">
        ⌘K
      </kbd>
    </button>
  );
}
