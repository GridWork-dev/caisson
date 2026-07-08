"use client";

import { forwardRef, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

import { mergeRefs } from "../lib/use-floating-position";

import "./drawer.css";

export type DrawerSide = "top" | "right" | "bottom" | "left";

export interface DrawerProps {
  /** The panel's content. */
  children: ReactNode;
  /** Open state — controlled, like the kit's other stateful primitives (`Popover`, `Menu`). Unlike
   * those, Drawer does not render its own trigger button: a modal dialog can be invoked from
   * anywhere, so instead of coupling to one trigger ref it captures `document.activeElement` on
   * open and restores it on close. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The viewport edge the panel is anchored to. Default "right". */
  side?: DrawerSide;
  /** Accessible name for the dialog — `role="dialog"` has no implicit name, so this is required
   * (unlike `Popover`/`Menu`'s optional `aria-label`, which only names an icon-only trigger). */
  "aria-label": string;
  className?: string;
}

// Same focusable-elements query the WAI-ARIA APG dialog pattern's focus trap uses.
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Drawer — a modal, edge-anchored dialog: `role="dialog"` + `aria-modal="true"`, a hand-written
 * focus trap (Tab/Shift+Tab cycle within the panel's focusable elements while open), Escape closes,
 * and a scrim that closes on click. Unlike `Popover` (non-modal, no trap — see its doc comment),
 * a Drawer owns the interaction until dismissed, so trapping focus is correct here (ADR-0295,
 * dialog-class per the APG dialog pattern). Portaled to `document.body` (via `react-dom`'s own
 * `createPortal` — no new dependency); body scroll is locked while open. Opening moves focus to the
 * first focusable element inside the panel (falling back to the panel itself when there is none);
 * closing restores focus to whatever had it before the dialog opened.
 *
 * Recipe-compliant (ADR-0099): co-located CSS reading only `var(--cs-*)`; BEM block `cs-drawer`.
 * Owns state/DOM/focus, so `"use client"`.
 */
export const Drawer = forwardRef<HTMLDivElement, DrawerProps>(function Drawer(
  {
    children,
    open,
    onOpenChange,
    side = "right",
    "aria-label": ariaLabel,
    className,
  },
  forwardedRef,
) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Move focus into the panel whenever it opens (first focusable descendant, falling back to the
  // panel itself — WCAG 2.4.3, the portal breaks natural tab order). Capture the pre-open focus so
  // it can be restored on close; a dialog can be invoked from anywhere, so this reads
  // `document.activeElement` rather than coupling to a specific trigger ref.
  useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      const focusables =
        panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      (focusables?.[0] ?? panelRef.current)?.focus();
    } else {
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
    }
  }, [open]);

  // Body scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape closes; Tab/Shift+Tab traps focus within the panel (APG dialog pattern) — unlike
  // Popover/Menu, this actively fights the browser's natural tab order to keep focus inside while
  // the dialog is modal.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onOpenChange(false);
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables =
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="cs-drawer-scrim" onClick={() => onOpenChange(false)}>
      <div
        ref={mergeRefs(panelRef, forwardedRef)}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        data-side={side}
        className={className ? `cs-drawer ${className}` : "cs-drawer"}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
});
