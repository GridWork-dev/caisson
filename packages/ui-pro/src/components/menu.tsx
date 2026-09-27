"use client";

import { useEffect, useId, useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { createPortal } from "react-dom";

import type { Placement } from "../lib/position.ts";
import { useFloatingPosition } from "../lib/use-floating-position.ts";

import "./menu.css";

export interface MenuItemSpec {
  id: string;
  label: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  /** Styles the item as a destructive action (e.g. "Delete", "Revoke"). */
  danger?: boolean;
}

export interface MenuProps {
  /** The trigger button's content (text/icon) — Menu renders the `<button>` itself. */
  trigger: ReactNode;
  items: readonly MenuItemSpec[];
  /** Open state — controlled, like the kit's other stateful primitives (`Dialog`, `Popover`). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placement?: Placement;
  /** Names the trigger for an icon-only trigger. Omit when `trigger` is itself readable text. */
  "aria-label"?: string;
  className?: string;
}

/**
 * Menu (Dropdown) — an action list per the WAI-ARIA Menu Button pattern: the trigger carries
 * `aria-haspopup="menu"`/`aria-expanded`; the panel is `role="menu"` of `role="menuitem"` buttons
 * with roving `tabindex` and Up/Down/Home/End keyboard navigation (native Enter/Space activation
 * comes free from real `<button>` elements). Opening moves focus to the first enabled item;
 * Escape closes and returns focus to the trigger; a pointer outside closes without stealing
 * focus. Portaled to `document.body` (via `react-dom`'s `createPortal` — no new dependency);
 * positioned by the kit's hand-rolled `computeFloatingPosition` (ADR-0291 — no `@floating-ui`, no
 * Radix). NOT for a list of plain navigation links read top-to-bottom (that is a disclosure — see
 * `Popover` — not a menu; WAI-ARIA reserves `role="menu"` for action/command lists).
 *
 * Recipe-compliant (ADR-0099): co-located CSS reading only `var(--cs-*)`; BEM block `cs-menu`.
 * Owns state/DOM measurement, so `"use client"`.
 */
export function Menu({
  trigger,
  items,
  open,
  onOpenChange,
  placement = "bottom",
  className,
  "aria-label": ariaLabel,
}: MenuProps): ReactNode {
  const id = useId();
  const menuId = `cs-menu-${id}`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const enabled = items.filter((i) => !i.disabled);

  const style = useFloatingPosition(open, triggerRef, panelRef, placement);

  // Move focus into the menu (first enabled item) whenever it opens.
  // `enabled`/`items` are re-derived every render from props — only `open`'s transition matters
  // here (focus the first enabled item once, when the menu opens).
  useEffect(() => {
    if (open && enabled[0]) itemRefs.current[enabled[0].id]?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        onOpenChange(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, onOpenChange]);

  function close() {
    triggerRef.current?.focus();
    onOpenChange(false);
  }

  function onMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const current = document.activeElement?.getAttribute("data-menu-item-id");
    const idx = enabled.findIndex((i) => i.id === current);
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      // APG Menu Button: Tab closes the menu and lets focus move on naturally — don't
      // preventDefault, and don't re-focus the trigger the way Escape/selection do.
      onOpenChange(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = enabled[(idx + 1) % enabled.length];
      if (next) itemRefs.current[next.id]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = enabled[(idx - 1 + enabled.length) % enabled.length];
      if (prev) itemRefs.current[prev.id]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      const first = enabled[0];
      if (first) itemRefs.current[first.id]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      const last = enabled[enabled.length - 1];
      if (last) itemRefs.current[last.id]?.focus();
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={
          className ? `cs-menu-trigger ${className}` : "cs-menu-trigger"
        }
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={ariaLabel}
        onClick={() => onOpenChange(!open)}
      >
        {trigger}
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              id={menuId}
              role="menu"
              aria-label={ariaLabel}
              // Programmatically focusable container (items use roving tabIndex=-1 and are
              // focused on open); satisfies the menu role's focusability contract.
              tabIndex={-1}
              className="cs-menu"
              style={style ?? { position: "fixed", top: -9999, left: -9999 }}
              data-visible={style ? "true" : undefined}
              onKeyDown={onMenuKeyDown}
            >
              {items.map((item) => (
                <button
                  key={item.id}
                  ref={(el) => {
                    itemRefs.current[item.id] = el;
                  }}
                  type="button"
                  role="menuitem"
                  data-menu-item-id={item.id}
                  tabIndex={-1}
                  disabled={item.disabled}
                  data-danger={item.danger ? "" : undefined}
                  className="cs-menu__item"
                  onClick={() => {
                    item.onSelect();
                    close();
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
