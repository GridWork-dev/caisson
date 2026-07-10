"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";

import { Button } from "./button";
import styles from "./waitlist-form.module.css";

type State = "idle" | "loading" | "ok" | "error";

// Cloudflare Turnstile client widget (D9) — env-gated on the PUBLIC site key. When unset (dev / not
// yet provisioned) NO widget renders and the form behaves exactly as before (honeypot only); the
// server verify (/api/waitlist) is already fail-closed on TURNSTILE_SECRET, so the two halves arm
// together at DEPLOY. Both are dormant until the operator provisions the CF Turnstile site+secret.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

// Low-key product-updates capture (ADR-0082 — the site is live self-serve; this is NOT the
// conversion CTA, just a "get product updates" subscribe placed in the footer, the changelog,
// the plans page, and the EU AI Act page). POSTs to the Pages Function (Resend Segments,
// server-side). Fires Plausible.
export function UpdatesForm({ source = "site" }: { source?: string }) {
  const [email, setEmail] = useState("");
  // Affirmative consent (security audit LOW follow-up, P1 queue) — an unchecked box blocks
  // submission; the checkbox is the opt-in, the footnote below just restates it in prose.
  const [consent, setConsent] = useState(false);
  // Honeypot: humans leave this blank; bots fill it. Silently no-ops on submit if non-empty.
  const [honeyPot, setHoneyPot] = useState("");
  const [state, setState] = useState<State>("idle");
  // Focus the status message after a terminal state change for screen-reader UX.
  const statusRef = useRef<HTMLParagraphElement>(null);

  // Turnstile: token captured from the widget callback; widget rendered once the api.js script
  // loads (explicit-render). Only active when TURNSTILE_SITE_KEY is set.
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReady, setTurnstileReady] = useState(false);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (state === "ok" || state === "error") {
      statusRef.current?.focus();
    }
  }, [state]);

  useEffect(() => {
    if (
      !TURNSTILE_SITE_KEY ||
      !turnstileReady ||
      !turnstileRef.current ||
      !window.turnstile ||
      widgetIdRef.current !== null
    ) {
      return;
    }
    widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token) => setTurnstileToken(token),
      "error-callback": () => setTurnstileToken(""),
      "expired-callback": () => setTurnstileToken(""),
      theme: "auto",
      size: "flexible",
    });
  }, [turnstileReady]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "loading") return;
    // Affirmative consent required — the browser's native `required` on the checkbox already
    // blocks this, this is the JS-submit-path backstop.
    if (!consent) return;
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
        body: JSON.stringify(
          turnstileToken
            ? { email, source, turnstileToken }
            : { email, source },
        ),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setState("ok");
      window.plausible?.("Signup", { props: { plan: "updates", source } });
    } catch {
      setState("error");
      // Turnstile tokens are single-use — refresh the widget so a retry gets a fresh one.
      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
        setTurnstileToken("");
      }
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
        Subscribed. We&apos;ll send occasional product updates — check your spam
        folder if the confirmation doesn&apos;t arrive.
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
        className={styles.emailInput}
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
      {TURNSTILE_SITE_KEY && (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
            strategy="afterInteractive"
            onLoad={() => setTurnstileReady(true)}
          />
          {/* No aria-label: it's prohibited on a role-less div (axe aria-prohibited-attr);
              the Turnstile iframe injected here names itself. */}
          <div ref={turnstileRef} style={{ flexBasis: "100%" }} />
        </>
      )}
      <label
        style={{
          flexBasis: "100%",
          display: "flex",
          alignItems: "flex-start",
          gap: "var(--cs-space-2)",
          fontSize: "var(--cs-text-xs)",
        }}
      >
        <input
          type="checkbox"
          required
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          disabled={state === "loading"}
          style={{ marginTop: "2px" }}
        />
        <span className="cs-muted">
          I agree to receive product update emails.{" "}
          <Link href="/legal/privacy" className="cs-link">
            Privacy policy
          </Link>
        </span>
      </label>
      <Button
        type="submit"
        variant="ghost"
        disabled={
          state === "loading" ||
          !consent ||
          (Boolean(TURNSTILE_SITE_KEY) && !turnstileToken)
        }
      >
        {state === "loading" ? "Subscribing…" : "Get product updates"}
      </Button>
      <p
        className="cs-muted"
        style={{
          flexBasis: "100%",
          fontSize: "var(--cs-text-xs)",
          marginTop: "var(--cs-space-1)",
        }}
      >
        Occasional product updates. Unsubscribe anytime.
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
