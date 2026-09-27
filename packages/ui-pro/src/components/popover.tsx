"use client";

import { useEffect, useId, useRef } from "react";
import type { AriaAttributes, ReactNode } from "react";
import { createPortal } from "react-dom";

import type { Placement } from "../lib/position.ts";
import { useFloatingPosition } from "../lib/use-floating-position.ts";

import "./popover.css";

export interface PopoverProps {
  /** The trigger button's content (text/icon) — Popover renders the `<button>` itself. */
  trigger: ReactNode;
  /** The panel's content. */
  children: ReactNode;
  /** Open state — controlled, like the kit's other stateful primitives (`Dialog`, `Tabs`). A
   * parent coordinating several Popovers (e.g. "close the others when one opens", as the nav's
   * trigger row does) owns one shared index and passes each instance its own `open`. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placement?: Placement;
  /** Names the trigger for an icon-only trigger. Omit when `trigger` is itself readable text. */
  "aria-label"?: string;
  /** Marks the trigger as pointing at the current page/section (e.g. a nav disclosure whose
   * panel contains the active route) — passed straight through to the trigger `<button>`. */
  "aria-current"?: AriaAttributes["aria-current"];
  className?: string | undefined;
  panelClassName?: string | undefined;
}

/**
 * Popover — a non-modal, trigger-anchored disclosure: `aria-expanded`/`aria-controls` on the
 * trigger, plain content in the panel (no `role="dialog"` — a popover isn't a dialog and doesn't
 * trap focus). Portaled to `document.body` (via `react-dom`'s `createPortal` — no new dependency)
 * so it escapes any ancestor's overflow/stacking context, which breaks the natural DOM tab order
 * (the panel no longer sits next to its trigger) — per the APG disclosure-with-portal guidance,
 * focus is moved explicitly on open/close instead: opening moves focus onto the panel itself
 * (`tabIndex={-1}`, no visible content is assumed focusable) so a plain Tab from there reaches the
 * panel's own links in natural order; every *keyboard-initiated* close (Escape, or toggling the
 * trigger closed) returns focus to the trigger. An outside pointerdown close deliberately does
 * NOT return focus — the user clicked somewhere else on purpose, and stealing focus back to the
 * trigger would fight that. Positioned by the kit's hand-rolled `computeFloatingPosition`
 * (ADR-0291 — no `@floating-ui`, no Radix). The disclosure contract mirrors the pattern the site's
 * own nav-panels trigger row hand-rolled — this is that logic, audited once and shared.
 *
 * Recipe-compliant (ADR-0099): co-located CSS reading only `var(--cs-*)`; BEM block `cs-popover`.
 * Owns state/DOM measurement, so `"use client"`.
 */
export function Popover({
  trigger,
  children,
  open,
  onOpenChange,
  placement = "bottom",
  className,
  panelClassName,
  "aria-label": ariaLabel,
  "aria-current": ariaCurrent,
}: PopoverProps): ReactNode {
  const id = useId();
  const panelId = `cs-popover-${id}`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const style = useFloatingPosition(open, triggerRef, panelRef, placement);

  // Move focus into the panel whenever it opens (WCAG 2.4.3 — the portal breaks natural tab
  // order, so this is explicit). `panelRef.current` is only non-null once open (see JSX below).
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        triggerRef.current?.focus();
        onOpenChange(false);
      }
    }
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        // Outside pointer close — do not steal focus back to the trigger (APG guidance).
        onOpenChange(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, onOpenChange]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={
          className ? `cs-popover-trigger ${className}` : "cs-popover-trigger"
        }
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={ariaLabel}
        aria-current={ariaCurrent}
        onClick={() => {
          const next = !open;
          // Closing via the trigger is a keyboard-reachable path too (Enter/Space on a focused
          // trigger) — make it consistent with Escape and explicitly return focus, since a mouse
          // click doesn't focus a <button> in every browser (Safari/Firefox default off).
          if (!next) triggerRef.current?.focus();
          onOpenChange(next);
        }}
      >
        {trigger}
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              id={panelId}
              tabIndex={-1}
              className={
                panelClassName ? `cs-popover ${panelClassName}` : "cs-popover"
              }
              style={style ?? { position: "fixed", top: -9999, left: -9999 }}
              data-visible={style ? "true" : undefined}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
