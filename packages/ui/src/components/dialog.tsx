"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

import { Icon } from "./icon";

import "./dialog.css";

// Module-level so nested dialogs share one lock: the innermost close must not restore scroll
// while an outer dialog is still open (IN-08).
let scrollLockCount = 0;
let previousBodyOverflow = "";

/** Locks `document.body` scroll. `showModal()` gives focus-trap/inert/backdrop for free but not
 * background scroll-lock — call on open, and call `unlockBodyScroll` on close/unmount to restore.
 * Counted so nested dialogs don't unlock each other's scroll prematurely. */
export function lockBodyScroll(): void {
  if (scrollLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  scrollLockCount++;
}

/** Reverses one `lockBodyScroll` call; only restores the prior `overflow` value once every lock
 * has been released. */
export function unlockBodyScroll(): void {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.overflow = previousBodyOverflow;
  }
}

export interface DialogProps {
  /** Open/closed (controlled). Driven onto the native `<dialog>` via `showModal()`/`close()`. */
  open: boolean;
  /** Called when the dialog closes (Escape, backdrop click, or the close button). */
  onClose: () => void;
  /** Accessible title, shown in the header and used as the dialog's `aria-label`. */
  title: string;
  /** Centered modal (default) or an edge sheet. */
  variant?: "modal" | "drawer";
  /** Which edge the drawer slides from. Ignored for `modal`. Default "right". "top" is a
   * full-width sheet capped to content height instead of a full-height side column — the shape
   * a nav drawer under a fixed header bar wants. */
  side?: "left" | "right" | "top";
  /** Hide the default header (title + close button) to supply a fully custom body. */
  hideHeader?: boolean;
  /** Extra class merged onto the `<dialog>` element, for a consumer-specific override (e.g. an
   * app pinning the drawer below its own fixed header). */
  className?: string;
  children: ReactNode;
}

/**
 * Dialog — a modal or edge-drawer built on the native `<dialog>` element opened with `showModal()`,
 * which supplies the focus trap, Escape-to-close, inert background, and focus-return that a
 * hand-rolled `role="dialog"` div lacks (WCAG 2.4.11 / 2.1.2). Driven by the `open` prop; a backdrop
 * click or Escape calls `onClose`. The close button and title live in a default header unless
 * `hideHeader` is set.
 */
export function Dialog({
  open,
  onClose,
  title,
  variant = "modal",
  side = "right",
  hideHeader = false,
  className,
  children,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  // Drive the native dialog from `open`. showModal()/close() are idempotent-guarded so the dialog's
  // own close event (Escape) → onClose → this effect is a no-op, not a loop.
  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    else if (!open && dlg.open) dlg.close();
  }, [open]);

  // Background scroll-lock (IN-08) — showModal() doesn't provide this on its own.
  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={className ? `cs-dialog ${className}` : "cs-dialog"}
      data-variant={variant}
      data-side={variant === "drawer" ? side : undefined}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        // A click on the dialog element itself is a backdrop click (panel clicks land on children).
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="cs-dialog__panel">
        {hideHeader ? null : (
          <div className="cs-dialog__header">
            <span className="cs-dialog__title">{title}</span>
            <button
              type="button"
              className="cs-dialog__close"
              aria-label="Close"
              onClick={onClose}
            >
              <Icon name="x" />
            </button>
          </div>
        )}
        <div className="cs-dialog__body">{children}</div>
      </div>
    </dialog>
  );
}
