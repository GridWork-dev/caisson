"use client";

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
import { Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { AskAiPanel } from "./ask-ai/ask-ai-panel";
import styles from "./search.module.css";

// The sitewide ⌘K palette (ADR-0196) gains an "Ask AI" tab (ADR-0234 F3, placement 2), wired to the same
// /api/ask route as the docs widget. The keyword tab stays the Fumadocs static search index (browser-side,
// pre-built at /api/search); the Ask tab renders the shared AskAiPanel — grounded, cited, streamed.
type Tab = "search" | "ask";
const TAB_ORDER: readonly Tab[] = ["search", "ask"];

// Static suggested entry pages (ADR-0374 d81c2b94f6dcd55b) — the palette showed a bare empty input
// with nothing below it before the first keystroke. No recents/persistence: a fixed on-ramp, every
// href a real route that ships today (docs landing, the getting-started quickstart, the glossary
// index).
const SUGGESTED_PAGES: readonly { href: string; label: string }[] = [
  { href: "/docs", label: "Docs" },
  { href: "/docs/getting-started", label: "Getting started" },
  { href: "/glossary", label: "Glossary" },
];

export default function DefaultSearchDialog(props: SharedProps) {
  const { search, setSearch, query } = useDocsSearch({
    client: oramaStaticClient(),
  });
  const [tab, setTab] = useState<Tab>("search");
  const uid = useId();
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({
    search: null,
    ask: null,
  });

  // P1-004 (browser audit): every trigger that opens this dialog (the marketing nav's
  // NavSearchTrigger, fumadocs' own sidebar SearchTrigger, the mobile drawer) calls the shared
  // `setOpenSearch(true)` directly instead of rendering Radix's `<Dialog.Trigger>` — so Radix's
  // built-in "return focus to the trigger on close" never fires (its internal `triggerRef` stays
  // null). Track whatever element was focused when the dialog opened and restore it ourselves on
  // every dismissal path (Escape, the close button, backdrop click all funnel through Radix's
  // `onCloseAutoFocus`).
  const triggerRef = useRef<HTMLElement | null>(null);

  const openAsk = (): void => {
    setTab("ask");
    if (typeof window !== "undefined") {
      window.plausible?.("ask_ai_opened", { props: { surface: "palette" } });
    }
  };

  const selectTab = (next: Tab): void => {
    if (next === "ask") openAsk();
    else setTab(next);
  };

  // Roving-tabindex tablist (ADR-0374 00464c82f91d07e0): arrow keys move the tab selection AND
  // focus directly, matching the standard ARIA tab pattern (only the active tab is in the Tab
  // order — `tabIndex` below).
  const onTabKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    current: Tab,
  ): void => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const idx = TAB_ORDER.indexOf(current);
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const next = TAB_ORDER[(idx + dir + TAB_ORDER.length) % TAB_ORDER.length];
    if (next === undefined) return;
    selectTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <SearchDialog
      search={search}
      onSearchChange={setSearch}
      isLoading={query.isLoading}
      {...props}
    >
      <SearchDialogOverlay />
      <SearchDialogContent
        onOpenAutoFocus={(event) => {
          // Capture the pre-open trigger synchronously, right here, before Radix's own default
          // autofocus (or the redirect below) ever moves focus off it — a race condition, not the
          // preventDefault below, is what onOpenAutoFocus exists to let a consumer get ahead of.
          // A useEffect keyed on `open` ran too late: Radix's own focus-scope effect (which fires
          // this same callback) had already relocated focus by the time that effect's turn came
          // up in React's bottom-up passive-effect flush, so `document.activeElement` was already
          // the about-to-unmount query input, not the real trigger (browser-audit 9ffeca4b).
          triggerRef.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;

          // The Ask-AI tab (ADR-0234) added a tablist BEFORE the input, so Radix's default "focus
          // the first tabbable on open" landed on the Search TAB button, not the query field
          // (browser-audit 9ffeca4b, warn). Redirect first focus to the search input. The Ask tab
          // keeps its own AskAiPanel focusOnOpen, so only override for the search tab.
          if (tab !== "search") return;
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)
            ?.querySelector<HTMLInputElement>("input")
            ?.focus();
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
        <div
          className={styles.tabs}
          role="tablist"
          aria-label="Search or ask AI"
        >
          <button
            ref={(el) => {
              tabRefs.current.search = el;
            }}
            type="button"
            role="tab"
            id={`${uid}-tab-search`}
            aria-selected={tab === "search"}
            aria-controls={`${uid}-panel-search`}
            tabIndex={tab === "search" ? 0 : -1}
            data-active={tab === "search"}
            className={styles.tab}
            onClick={() => selectTab("search")}
            onKeyDown={(e) => onTabKeyDown(e, "search")}
          >
            Search
          </button>
          <button
            ref={(el) => {
              tabRefs.current.ask = el;
            }}
            type="button"
            role="tab"
            id={`${uid}-tab-ask`}
            aria-selected={tab === "ask"}
            aria-controls={`${uid}-panel-ask`}
            tabIndex={tab === "ask" ? 0 : -1}
            data-active={tab === "ask"}
            className={styles.tab}
            onClick={() => selectTab("ask")}
            onKeyDown={(e) => onTabKeyDown(e, "ask")}
          >
            <Sparkles size={14} aria-hidden="true" />
            Ask AI
          </button>
        </div>

        {tab === "search" ? (
          <div
            id={`${uid}-panel-search`}
            role="tabpanel"
            aria-labelledby={`${uid}-tab-search`}
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
          </div>
        ) : (
          <div
            id={`${uid}-panel-ask`}
            role="tabpanel"
            aria-labelledby={`${uid}-tab-ask`}
            className={styles.askTab}
          >
            <AskAiPanel surface="palette" focusOnOpen />
          </div>
        )}
      </SearchDialogContent>
    </SearchDialog>
  );
}
