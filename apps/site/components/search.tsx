"use client";

import { create } from "@orama/orama";
import { useDocsSearch } from "fumadocs-core/search/client";
import { oramaStaticClient } from "fumadocs-core/search/client/orama-static";
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  type SharedProps,
} from "fumadocs-ui/components/dialog/search";
import { X } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

import styles from "./search.module.css";

// The sitewide ⌘K palette (ADR-0196): the Fumadocs static Orama index, pre-built at build time into
// /api/search and searched entirely in the browser — no server at request time.
function initOrama() {
  return create({ schema: { _: "string" }, language: "english" });
}

// Static suggested entry pages (ADR-0374 d81c2b94f6dcd55b) — the palette showed a bare empty input
// with nothing below it before the first keystroke. No recents/persistence: a fixed on-ramp, every
// href a real route that ships today.
const SUGGESTED_PAGES: readonly { href: string; label: string }[] = [
  { href: "/docs", label: "Docs" },
  { href: "/docs/getting-started", label: "Getting started" },
  { href: "/marketplace", label: "Marketplace" },
];

export default function DefaultSearchDialog(props: SharedProps) {
  const { search, setSearch, query } = useDocsSearch({
    client: oramaStaticClient({ initOrama }),
  });

  // P1-004 (browser audit): every trigger that opens this dialog (the marketing nav's
  // NavSearchTrigger, fumadocs' own sidebar SearchTrigger, the mobile drawer) calls the shared
  // `setOpenSearch(true)` directly instead of rendering Radix's `<Dialog.Trigger>` — so Radix's
  // built-in "return focus to the trigger on close" never fires (its internal `triggerRef` stays
  // null). Track whatever element was focused when the dialog opened and restore it ourselves on
  // every dismissal path (Escape, the close button, backdrop click all funnel through Radix's
  // `onCloseAutoFocus`).
  const triggerRef = useRef<HTMLElement | null>(null);

  return (
    <SearchDialog
      search={search}
      onSearchChange={setSearch}
      isLoading={query.isLoading}
      {...props}
    >
      <SearchDialogOverlay />
      <SearchDialogContent
        onOpenAutoFocus={() => {
          // Capture the pre-open trigger synchronously, before Radix's own default autofocus
          // moves focus off it (browser-audit 9ffeca4b).
          triggerRef.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          // Only restore to an element still in the document — the captured trigger can have
          // unmounted (e.g. a mobile-drawer trigger closed alongside the dialog) by the time this
          // fires, and .focus() on a detached node is a silent no-op that leaves focus on <body>.
          if (triggerRef.current?.isConnected) {
            triggerRef.current.focus();
          }
        }}
      >
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose className={styles.closeEsc} />
          <SearchDialogClose
            className={styles.closeIcon}
            aria-label="Close search"
          >
            <X size={16} aria-hidden="true" />
          </SearchDialogClose>
        </SearchDialogHeader>
        {search === "" ? (
          <div className={styles.suggestions}>
            <span className={styles.suggestionsLabel}>Jump to</span>
            <ul className={styles.suggestionsList}>
              {SUGGESTED_PAGES.map((p) => (
                <li key={p.href}>
                  <Link
                    href={p.href}
                    className={styles.suggestionLink}
                    onClick={() => props.onOpenChange(false)}
                  >
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <SearchDialogList
            items={query.data !== "empty" ? query.data : null}
          />
        )}
      </SearchDialogContent>
    </SearchDialog>
  );
}
