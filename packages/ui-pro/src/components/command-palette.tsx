"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Dialog } from "@caisson-sh/ui/components";

import { fuzzyFilter } from "../lib/fuzzy.ts";

import "./command-palette.css";

export interface CommandAction {
  /** Stable id (React key + `aria-activedescendant` target). */
  id: string;
  label: string;
  /** Group heading the action sorts under; ungrouped actions share one unlabeled group. */
  group?: string;
  /** Extra searchable terms (synonyms, ids) that never render. */
  keywords?: string;
  /** Trailing hint — a shortcut chip, a category tag. */
  hint?: ReactNode;
  run: () => void;
}

export interface CommandPaletteProps {
  actions: readonly CommandAction[];
  /** Open state (controlled). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeholder?: string;
  /** Bind ⌘K / Ctrl-K globally to open. Default true. */
  hotkey?: boolean;
  /** Accessible dialog title. */
  title?: string;
  emptyLabel?: string;
}

const keyOf = (a: CommandAction): string => `${a.label} ${a.keywords ?? ""}`;

/**
 * CommandPalette — a ⌘K command menu: fuzzy-matched, grouped, fully keyboard-driven (↑/↓ to move,
 * Enter to run, Esc to close). Built on the floor `Dialog` (native `<dialog>` → focus trap +
 * Escape + focus-return). Matching is the pure `fuzzyFilter` (subsequence scoring, no deps); the
 * combobox/listbox ARIA wiring (`aria-activedescendant`) keeps the active option announced without
 * moving DOM focus off the input.
 */
export function CommandPalette({
  actions,
  open,
  onOpenChange,
  placeholder = "Type a command or search…",
  hotkey = true,
  title = "Command palette",
  emptyLabel = "No matching commands.",
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => fuzzyFilter(query, actions, keyOf),
    [query, actions],
  );

  // Group in first-seen group order; each group's items keep their fuzzy rank.
  const groups = useMemo(() => {
    const map = new Map<string, CommandAction[]>();
    for (const a of filtered) {
      const g = a.group ?? "";
      const bucket = map.get(g);
      if (bucket) bucket.push(a);
      else map.set(g, [a]);
    }
    return [...map.entries()].map(([label, items]) => ({ label, items }));
  }, [filtered]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // Reset + focus when the palette opens; showModal() runs in Dialog's effect, so defer the focus.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Keep the active index in range as the filtered set shrinks.
  useEffect(() => {
    setActive((i) => (i >= flat.length ? Math.max(0, flat.length - 1) : i));
  }, [flat.length]);

  // Scroll the active option into view on arrow nav.
  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  // Global ⌘K / Ctrl-K to open.
  useEffect(() => {
    if (!hotkey) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkey, onOpenChange]);

  const runAt = (i: number) => {
    const action = flat[i];
    if (!action) return;
    onOpenChange(false);
    action.run();
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runAt(active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onOpenChange(false);
    }
  };

  // Global flat index → per-render offset, so each option gets a stable id + active flag.
  let flatIndex = -1;

  return (
    <Dialog
      open={open}
      onClose={() => onOpenChange(false)}
      title={title}
      hideHeader
    >
      <div className="cs-cmdk">
        <input
          ref={inputRef}
          className="cs-cmdk__input"
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="cs-cmdk-list"
          aria-activedescendant={
            flat[active] ? `cs-cmdk-opt-${active}` : undefined
          }
          aria-label={title}
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onInputKeyDown}
        />
        <div
          ref={listRef}
          id="cs-cmdk-list"
          className="cs-cmdk__list"
          role="listbox"
          aria-label={title}
        >
          {flat.length === 0 ? (
            <p className="cs-cmdk__empty">{emptyLabel}</p>
          ) : (
            groups.map((group) => (
              <div
                className="cs-cmdk__group"
                key={group.label || "_ungrouped"}
                role="group"
                aria-label={group.label || undefined}
              >
                {group.label ? (
                  <div className="cs-cmdk__group-label" role="presentation">
                    {group.label}
                  </div>
                ) : null}
                {group.items.map((a) => {
                  flatIndex += 1;
                  const i = flatIndex;
                  return (
                    <div
                      key={a.id}
                      id={`cs-cmdk-opt-${i}`}
                      className="cs-cmdk__option"
                      role="option"
                      aria-selected={i === active}
                      data-active={i === active}
                      // aria-activedescendant pattern: DOM focus stays on the input (which owns
                      // the keyboard); options are programmatically focusable click targets.
                      tabIndex={-1}
                      onMouseMove={() => setActive(i)}
                      onClick={() => runAt(i)}
                      onKeyDown={(e) => {
                        // A clicked option holds DOM focus (tabIndex=-1); Enter re-runs it.
                        if (e.key === "Enter") {
                          e.preventDefault();
                          runAt(i);
                        }
                      }}
                    >
                      <span className="cs-cmdk__option-label">{a.label}</span>
                      {a.hint ? (
                        <span className="cs-cmdk__option-hint">{a.hint}</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </Dialog>
  );
}
