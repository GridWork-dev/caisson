"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

import { Icon } from "./icon";

import "./dialog.css";

export interface DialogProps {
  /** Open/closed (controlled). Driven onto the native `<dialog>` via `showModal()`/`close()`. */
  open: boolean;
  /** Called when the dialog closes (Escape, backdrop click, or the close button). */
  onClose: () => void;
  /** Accessible title, shown in the header and used as the dialog's `aria-label`. */
  title: string;
  /** Centered modal (default) or an edge sheet. */
  variant?: "modal" | "drawer";
  /** Which edge the drawer slides from. Ignored for `modal`. Default "right". */
  side?: "left" | "right";
  /** Hide the default header (title + close button) to supply a fully custom body. */
  hideHeader?: boolean;
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

  return (
    <dialog
      ref={ref}
      className="cs-dialog"
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
