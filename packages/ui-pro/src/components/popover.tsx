"use client";

import { useEffect, useId, useRef } from "react";
import type { AriaAttributes, ReactNode } from "react";
import { createPortal } from "react-dom";

import type { Placement } from "../lib/position";
import { useFloatingPosition } from "../lib/use-floating-position";

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
 * trap focus), Escape closes and returns focus to the trigger, a pointer outside the trigger+panel
 * closes without stealing focus. Portaled to `document.body` (via `react-dom`'s `createPortal` —
 * no new dependency) so it escapes any ancestor's overflow/stacking context; positioned by the
 * kit's hand-rolled `computeFloatingPosition` (ADR-0291 — no `@floating-ui`, no Radix). The
 * disclosure contract (Escape/outside-click/focus-return) mirrors the pattern the site's own
 * nav-panels trigger row hand-rolled — this is that logic, audited once and shared.
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
        onClick={() => onOpenChange(!open)}
      >
        {trigger}
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              id={panelId}
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
