"use client";

import { useRef } from "react";
import type { HTMLAttributes, KeyboardEvent, ReactNode } from "react";

import "./tabs.css";

export interface TabItem {
  id: string;
  label: ReactNode;
  panel: ReactNode;
  disabled?: boolean;
}

export interface TabsProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> {
  items: readonly TabItem[];
  /** The active tab id — controlled, like the kit's other stateful primitives (`Dialog`, `Toast`). */
  value: string;
  onValueChange: (id: string) => void;
  /** Names the tablist for assistive tech when there is no adjacent visible heading. */
  "aria-label"?: string;
  orientation?: "horizontal" | "vertical";
}

/**
 * Tabs — a same-page panel switcher: `role="tablist"`/`role="tab"`/`role="tabpanel"` per the
 * WAI-ARIA Tabs authoring pattern, automatic activation (arrow keys move focus AND select),
 * roving `tabindex` (only the active tab is Tab-reachable), Home/End jump to the first/last
 * enabled tab, disabled tabs are skipped. Zero-Radix, zero dependencies (ADR-0291).
 *
 * NOT for cross-page navigation dressed as tabs — a set of links to sibling routes is a `<nav>`
 * with `aria-current="page"`, not a tablist (there is no same-page `tabpanel` to associate).
 *
 * Recipe-compliant (ADR-0099): co-located CSS reading only `var(--cs-*)`; `data-state`/
 * `data-orientation` drive styling by attribute selector; BEM block `cs-tabs`. Owns keyboard
 * focus, so `"use client"`.
 */
export function Tabs({
  items,
  value,
  onValueChange,
  orientation = "horizontal",
  className,
  "aria-label": ariaLabel,
  ...rest
}: TabsProps) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const enabled = items.filter((i) => !i.disabled);

  function focusAndSelect(id: string) {
    tabRefs.current[id]?.focus();
    onValueChange(id);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const idx = enabled.findIndex((i) => i.id === value);
    if (idx === -1) return;
    const nextKey = orientation === "vertical" ? "ArrowDown" : "ArrowRight";
    const prevKey = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
    if (e.key === nextKey) {
      e.preventDefault();
      focusAndSelect(enabled[(idx + 1) % enabled.length]!.id);
    } else if (e.key === prevKey) {
      e.preventDefault();
      focusAndSelect(enabled[(idx - 1 + enabled.length) % enabled.length]!.id);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusAndSelect(enabled[0]!.id);
    } else if (e.key === "End") {
      e.preventDefault();
      focusAndSelect(enabled[enabled.length - 1]!.id);
    }
  }

  const active = items.find((i) => i.id === value) ?? items[0];

  return (
    <div
      className={className ? `cs-tabs ${className}` : "cs-tabs"}
      data-orientation={orientation}
      {...rest}
    >
      {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- W3C APG roving-tabindex pattern: the tablist container is deliberately NOT a tab stop, only the active `role="tab"` button below carries tabIndex 0 (others -1); adding a tabIndex here would give the tablist two stops instead of one */}
      <div
        role="tablist"
        aria-orientation={orientation}
        aria-label={ariaLabel}
        className="cs-tabs__list"
        onKeyDown={onKeyDown}
      >
        {items.map((item) => {
          const selected = item.id === value;
          return (
            <button
              key={item.id}
              ref={(el) => {
                tabRefs.current[item.id] = el;
              }}
              type="button"
              role="tab"
              id={`cs-tab-${item.id}`}
              aria-selected={selected}
              // Only the active tab's panel is mounted below, so aria-controls on an inactive
              // tab must stay unset — otherwise it dangles, pointing at an id that doesn't exist
              // in the DOM (IN-02).
              aria-controls={selected ? `cs-tabpanel-${item.id}` : undefined}
              aria-disabled={item.disabled || undefined}
              tabIndex={selected ? 0 : -1}
              disabled={item.disabled}
              className="cs-tabs__tab"
              data-state={selected ? "active" : "inactive"}
              onClick={() => onValueChange(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {active ? (
        <div
          role="tabpanel"
          id={`cs-tabpanel-${active.id}`}
          aria-labelledby={`cs-tab-${active.id}`}
          tabIndex={0}
          className="cs-tabs__panel"
        >
          {active.panel}
        </div>
      ) : null}
    </div>
  );
}
