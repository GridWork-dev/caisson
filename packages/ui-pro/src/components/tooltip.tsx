"use client";

import {
  cloneElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  FocusEvent,
  KeyboardEvent,
  MouseEvent,
  ReactElement,
  ReactNode,
  Ref,
} from "react";
import { createPortal } from "react-dom";

import type { Placement } from "../lib/position.ts";
import {
  mergeRefs,
  useFloatingPosition,
} from "../lib/use-floating-position.ts";

import "./tooltip.css";

interface TriggerProps {
  ref?: Ref<HTMLElement>;
  onMouseEnter?: (e: MouseEvent) => void;
  onMouseLeave?: (e: MouseEvent) => void;
  onFocus?: (e: FocusEvent) => void;
  onBlur?: (e: FocusEvent) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  "aria-describedby"?: string | undefined;
}

export interface TooltipProps {
  /** The tooltip's text content. Keep it short — a tooltip is a label, not a panel. */
  content: ReactNode;
  /** The single trigger element (an icon button, a truncated label, a disabled control's
   * wrapper). Its ref and hover/focus/keydown handlers are merged in via `cloneElement`, so it
   * must be a single native DOM element (or forward its `ref`/props through to one). */
  children: ReactElement<TriggerProps>;
  placement?: Placement;
  /** Hover-open delay in ms (focus opens immediately — a keyboard user shouldn't wait). Default 400. */
  delay?: number;
}

/**
 * Tooltip — a hover/focus-triggered label for a trigger element. `role="tooltip"` content wired
 * via `aria-describedby` (WAI-ARIA Tooltip pattern); opens on hover (after `delay`) or focus
 * (immediately), closes on mouseleave, blur, or Escape (Escape is listened on the trigger — a
 * tooltip is never itself part of the tab order). Portaled to `document.body` (via `react-dom`'s
 * own `createPortal` — no new dependency) so it escapes any ancestor's overflow/stacking context;
 * positioned by the kit's hand-rolled `computeFloatingPosition` (ADR-0291 — no `@floating-ui`, no
 * Radix).
 *
 * Recipe-compliant (ADR-0099): co-located CSS reading only `var(--cs-*)`; BEM block `cs-tooltip`.
 * Owns state/DOM measurement, so `"use client"`.
 */
export function Tooltip({
  content,
  children,
  placement = "top",
  delay = 400,
}: TooltipProps): ReactNode {
  const [open, setOpen] = useState(false);
  const id = useId();
  const triggerRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const style = useFloatingPosition(open, triggerRef, panelRef, placement);

  useEffect(() => () => clearTimeout(showTimer.current), []);

  function showAfterDelay() {
    clearTimeout(showTimer.current);
    showTimer.current = setTimeout(() => setOpen(true), delay);
  }

  function showNow() {
    clearTimeout(showTimer.current);
    setOpen(true);
  }

  function hide() {
    clearTimeout(showTimer.current);
    setOpen(false);
  }

  // Memoized so the cloned trigger's ref identity is stable across renders that don't change the
  // caller's own ref (triggerRef itself never changes — it's a useRef object) — IN-04.
  const mergedRef = useMemo(
    () => mergeRefs(triggerRef, children.props.ref),
    [children.props.ref],
  );

  const trigger = cloneElement(children, {
    ref: mergedRef,
    onMouseEnter: (e: MouseEvent) => {
      children.props.onMouseEnter?.(e);
      showAfterDelay();
    },
    onMouseLeave: (e: MouseEvent) => {
      children.props.onMouseLeave?.(e);
      hide();
    },
    onFocus: (e: FocusEvent) => {
      children.props.onFocus?.(e);
      showNow();
    },
    onBlur: (e: FocusEvent) => {
      children.props.onBlur?.(e);
      hide();
    },
    onKeyDown: (e: KeyboardEvent) => {
      children.props.onKeyDown?.(e);
      if (e.key === "Escape") hide();
    },
    "aria-describedby": open ? id : undefined,
  });

  return (
    <>
      {trigger}
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              role="tooltip"
              id={id}
              className="cs-tooltip"
              style={style ?? { position: "fixed", top: -9999, left: -9999 }}
              data-visible={style ? "true" : undefined}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
