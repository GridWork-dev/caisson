"use client";

import { ChevronDown, Sparkles } from "lucide-react";
import { useState } from "react";

import { AskAiPanel } from "./ask-ai-panel";
import styles from "./ask-ai.module.css";

// The docs-inline Ask-AI widget (ADR-0234 F3, placement 1) — a collapsible entry in the docs sidebar
// banner, present on every docs page. Native <details> gives free, keyboard-accessible collapse; the
// panel mounts lazily on first open (so Turnstile never renders into a hidden container) and stays
// mounted after, and `ask_ai_opened` fires once on first expand (F6, count only — no question text).
export function DocsAskAi() {
  const [opened, setOpened] = useState(false);

  const onToggle = (e: React.SyntheticEvent<HTMLDetailsElement>): void => {
    if (e.currentTarget.open && !opened) {
      setOpened(true);
      if (typeof window !== "undefined") {
        window.plausible?.("ask_ai_opened", { props: { surface: "docs" } });
      }
    }
  };

  return (
    <details className={styles.docsRoot} onToggle={onToggle}>
      <summary className={styles.summary}>
        <Sparkles className={styles.summaryIcon} size={16} aria-hidden="true" />
        Ask AI about the docs
        <ChevronDown className={styles.chevron} size={16} aria-hidden="true" />
      </summary>
      <div className={styles.docsBody}>
        {opened && <AskAiPanel surface="docs" focusOnOpen />}
      </div>
    </details>
  );
}
