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
import { Sparkles } from "lucide-react";
import { useState } from "react";

import { AskAiPanel } from "./ask-ai/ask-ai-panel";
import styles from "./search.module.css";

// The sitewide ⌘K palette (ADR-0196) gains an "Ask AI" tab (ADR-0234 F3, placement 2), wired to the same
// /api/ask route as the docs widget. The keyword tab stays the Fumadocs static Orama index (browser-side,
// pre-built at /api/search); the Ask tab renders the shared AskAiPanel — grounded, cited, streamed.
function initOrama() {
  return create({ schema: { _: "string" }, language: "english" });
}

type Tab = "search" | "ask";

export default function DefaultSearchDialog(props: SharedProps) {
  const { search, setSearch, query } = useDocsSearch({
    client: oramaStaticClient({ initOrama }),
  });
  const [tab, setTab] = useState<Tab>("search");

  const openAsk = (): void => {
    setTab("ask");
    if (typeof window !== "undefined") {
      window.plausible?.("ask_ai_opened", { props: { surface: "palette" } });
    }
  };

  return (
    <SearchDialog
      search={search}
      onSearchChange={setSearch}
      isLoading={query.isLoading}
      {...props}
    >
      <SearchDialogOverlay />
      <SearchDialogContent>
        <div
          className={styles.tabs}
          role="tablist"
          aria-label="Search or ask AI"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "search"}
            data-active={tab === "search"}
            className={styles.tab}
            onClick={() => setTab("search")}
          >
            Search
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "ask"}
            data-active={tab === "ask"}
            className={styles.tab}
            onClick={openAsk}
          >
            <Sparkles size={14} aria-hidden="true" />
            Ask AI
          </button>
        </div>

        {tab === "search" ? (
          <>
            <SearchDialogHeader>
              <SearchDialogIcon />
              <SearchDialogInput />
              <SearchDialogClose />
            </SearchDialogHeader>
            <SearchDialogList
              items={query.data !== "empty" ? query.data : null}
            />
          </>
        ) : (
          <div className={styles.askTab}>
            <AskAiPanel surface="palette" autoFocus />
          </div>
        )}
      </SearchDialogContent>
    </SearchDialog>
  );
}
