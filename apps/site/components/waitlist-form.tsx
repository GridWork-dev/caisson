"use client";

import { useState } from "react";

type State = "idle" | "loading" | "ok" | "error";

// Pre-launch CTA is capture, not checkout (ADR-0046/0048). POSTs to the Pages Function,
// which adds the contact to Resend Segments server-side. Fires the Plausible Signup goal.
export function WaitlistForm({ source = "site" }: { source?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "loading") return;
    setState("loading");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setState("ok");
      window.plausible?.("Signup", { props: { plan: "waitlist", source } });
    } catch {
      setState("error");
    } finally {
      clearTimeout(timer);
    }
  }

  if (state === "ok") {
    return (
      <p className="cs-status" role="status">
        <span className="glyph" aria-hidden="true">
          ✓
        </span>
        You&apos;re on the early-access list. We&apos;ll be in touch.
      </p>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{ display: "flex", gap: "var(--cs-space-2)", flexWrap: "wrap" }}
    >
      <label
        htmlFor="waitlist-email"
        style={{ position: "absolute", left: "-9999px" }}
      >
        Work email
      </label>
      <input
        id="waitlist-email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={state === "loading"}
        style={{
          flex: "1 1 16rem",
          padding: "var(--cs-space-3) var(--cs-space-4)",
          borderRadius: "var(--cs-radius-md)",
          border: "1px solid var(--cs-border-strong)",
          background: "var(--cs-surface-1)",
          color: "var(--cs-fg)",
          fontFamily: "var(--cs-font-sans)",
          fontSize: "var(--cs-text-sm)",
        }}
      />
      <button
        type="submit"
        className="cs-btn cs-btn--primary"
        disabled={state === "loading"}
      >
        {state === "loading" ? "Joining…" : "Request early access"}
      </button>
      {state === "error" && (
        <p
          className="cs-status"
          role="alert"
          style={{ flexBasis: "100%", color: "var(--cs-danger)" }}
        >
          <span className="glyph" aria-hidden="true">
            !
          </span>
          Something went wrong. Try again in a moment.
        </p>
      )}
    </form>
  );
}
