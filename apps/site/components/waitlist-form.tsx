"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type State = "idle" | "loading" | "ok" | "error";

// Pre-launch CTA is capture, not checkout (ADR-0046/0048). POSTs to the Pages Function,
// which adds the contact to Resend Segments server-side. Fires the Plausible Signup goal.
export function WaitlistForm({ source = "site" }: { source?: string }) {
  const [email, setEmail] = useState("");
  // Honeypot: humans leave this blank; bots fill it. Silently no-ops on submit if non-empty.
  const [honeyPot, setHoneyPot] = useState("");
  const [state, setState] = useState<State>("idle");
  // Focus the status message after a terminal state change for screen-reader UX.
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state === "ok" || state === "error") {
      statusRef.current?.focus();
    }
  }, [state]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "loading") return;
    // Honeypot triggered — silently discard without surfacing an error.
    if (honeyPot) {
      setState("ok");
      return;
    }
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
      <p
        ref={statusRef}
        className="cs-status"
        role="status"
        // tabIndex enables programmatic focus from the useEffect above.
        tabIndex={-1}
      >
        <span className="glyph" aria-hidden="true">
          ✓
        </span>{" "}
        You&apos;re on the early-access list. You&apos;ll get one email when the
        first access window opens — check your spam folder if it doesn&apos;t
        arrive.
      </p>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{ display: "flex", gap: "var(--cs-space-2)", flexWrap: "wrap" }}
    >
      {/*
        Honeypot: off-screen, aria-hidden, tabIndex -1 so assistive tech skips it.
        Populated only by bots — a non-empty value short-circuits submission above.
      */}
      <input
        type="text"
        name="company_url"
        value={honeyPot}
        onChange={(e) => setHoneyPot(e.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        autoComplete="off"
        style={{
          position: "absolute",
          left: "-9999px",
          width: 0,
          height: 0,
          opacity: 0,
          pointerEvents: "none",
        }}
      />
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
      <p
        className="cs-muted"
        style={{
          flexBasis: "100%",
          fontSize: "var(--cs-text-xs)",
          marginTop: "var(--cs-space-1)",
        }}
      >
        By joining you agree to occasional product email. Unsubscribe anytime.{" "}
        <Link href="/legal/privacy">Privacy policy</Link>
      </p>
      {state === "error" && (
        <p
          ref={statusRef}
          className="cs-status"
          role="alert"
          tabIndex={-1}
          style={{ flexBasis: "100%", color: "var(--cs-danger)" }}
        >
          <span className="glyph" aria-hidden="true">
            !
          </span>{" "}
          Something went wrong. Try again in a moment.
        </p>
      )}
    </form>
  );
}
