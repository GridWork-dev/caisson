"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { Button, Dialog, Icon } from "@caisson-sh/ui/components";

import "./type-to-confirm.css";

/** The lifecycle of the confirmed action, driven by the caller's async handler. */
export type ConfirmState = "idle" | "busy" | "ok" | "warn" | "err";

export interface TypeToConfirmProps {
  open: boolean;
  title: string;
  message: ReactNode;
  /** The exact phrase (usually the resource name) the user must retype to arm confirm. */
  confirmationPhrase: string;
  /** Prompt above the retype input. Default names the phrase. */
  promptLabel?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` (default) tints confirm for a destructive action. */
  tone?: "default" | "danger";
  /** Result lifecycle (controlled). `busy` disables + shows progress; ok/warn/err show a banner. */
  state?: ConfirmState;
  /** Banner copy shown for ok/warn/err. */
  resultMessage?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  /** Fired alongside a confirmed action — an audit seam that takes a callback, never a store. */
  onAudit?: (event: { action: string; phrase: string }) => void;
}

const RESULT_ICON: Record<
  "ok" | "warn" | "err",
  "check" | "alert-triangle" | "alert"
> = {
  ok: "check",
  warn: "alert-triangle",
  err: "alert",
};

/**
 * TypeToConfirm — a destructive-action dialog armed by retyping the resource name. The confirm
 * button stays disabled until the typed phrase matches exactly (a deliberate-friction guard, not a
 * secret compare), then runs the caller's async action through a busy → ok/warn/err lifecycle shown
 * as an in-dialog banner. An optional `onAudit` callback records the action without any store
 * dependency. Built on the native-`<dialog>` floor `Dialog` (focus trap, Escape, focus-return).
 */
export function TypeToConfirm({
  open,
  title,
  message,
  confirmationPhrase,
  promptLabel,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  state = "idle",
  resultMessage,
  onConfirm,
  onCancel,
  onAudit,
}: TypeToConfirmProps) {
  const [typed, setTyped] = useState("");

  // Clear the arming input whenever the dialog (re)opens, so a prior attempt never leaves it armed.
  useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  const armed = typed.trim() === confirmationPhrase;
  const busy = state === "busy";
  const banner =
    state === "ok" || state === "warn" || state === "err" ? state : null;

  const confirm = () => {
    if (!armed || busy) return;
    onAudit?.({ action: title, phrase: confirmationPhrase });
    onConfirm();
  };

  return (
    <Dialog open={open} onClose={onCancel} title={title}>
      <div className="cs-ttc">
        <div className="cs-ttc__message">{message}</div>

        {banner ? (
          <div className="cs-ttc__banner" data-state={banner} role="status">
            <Icon name={RESULT_ICON[banner]} aria-hidden="true" />
            <span>{resultMessage}</span>
          </div>
        ) : null}

        <label className="cs-ttc__field">
          <span className="cs-ttc__prompt">
            {promptLabel ?? (
              <>
                Type{" "}
                <code className="cs-ttc__phrase">{confirmationPhrase}</code> to
                confirm
              </>
            )}
          </span>
          <input
            className="cs-ttc__input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirm();
            }}
            aria-label={`Type ${confirmationPhrase} to confirm`}
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
          />
        </label>

        <div className="cs-ttc__actions">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            data-tone={tone === "danger" ? "danger" : undefined}
            onClick={confirm}
            disabled={!armed || busy}
            aria-busy={busy || undefined}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
