"use client";

// The send-test-to-operator action (ADR-0284). Recipient is server-side + env-pinned — this button
// never takes or sends a user-supplied address, it only names which template to render + send.
import { useState } from "react";
import { Button } from "@caisson/ui/components";
import type { EmailTemplateId } from "@caisson/email";

type SendState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "sent"; delivered: boolean }
  | { status: "error"; message: string };

export function SendTestButton({
  templateId,
}: {
  templateId: EmailTemplateId;
}) {
  const [state, setState] = useState<SendState>({ status: "idle" });

  async function send() {
    setState({ status: "sending" });
    try {
      const res = await fetch("/api/admin/catalog/send-test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      const body = (await res.json().catch(() => null)) as {
        delivered?: boolean;
        error?: string;
      } | null;
      if (!res.ok) {
        setState({
          status: "error",
          message: body?.error ?? `request failed (${String(res.status)})`,
        });
        return;
      }
      setState({ status: "sent", delivered: body?.delivered === true });
    } catch {
      setState({ status: "error", message: "network error" });
    }
  }

  return (
    <div
      className="row"
      style={{ gap: "var(--cs-space-3)", alignItems: "center" }}
    >
      <Button
        size="sm"
        variant="ghost"
        onClick={() => void send()}
        disabled={state.status === "sending"}
      >
        {state.status === "sending" ? "Sending…" : "Send test to operator"}
      </Button>
      {state.status === "sent" ? (
        <span className="muted mono" style={{ fontSize: "var(--cs-text-sm)" }}>
          {state.delivered
            ? "Sent."
            : "Captured — RESEND_API_KEY not configured, no network send."}
        </span>
      ) : null}
      {state.status === "error" ? (
        <span
          className="mono"
          style={{ fontSize: "var(--cs-text-sm)", color: "var(--cs-danger)" }}
        >
          {state.message}
        </span>
      ) : null}
    </div>
  );
}
