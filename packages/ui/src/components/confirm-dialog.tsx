"use client";

import type { ReactNode } from "react";

import { Button } from "./button";
import { Dialog } from "./dialog";

import "./confirm-dialog.css";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Body copy explaining the consequence. */
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` tints the confirm action for a destructive/irreversible action. */
  tone?: "default" | "danger";
  /** Confirm is disabled + labelled busy while an async action runs. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * ConfirmDialog — a basic confirm/cancel prompt on the native-`<dialog>` `Dialog` primitive (focus
 * trap, Escape, focus-return for free). Cancel is the escape hatch (Escape/backdrop also cancel);
 * the confirm action carries the `danger` tone for destructive actions. For a retype-the-name armed
 * confirmation, the commercial `TypeToConfirm` layers on this shape.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} title={title}>
      <div className="cs-confirm">
        <p className="cs-confirm__message">{message}</p>
        <div className="cs-confirm__actions">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            data-tone={tone === "danger" ? "danger" : undefined}
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy || undefined}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
