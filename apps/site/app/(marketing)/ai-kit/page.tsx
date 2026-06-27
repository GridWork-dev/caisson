import Link from "next/link";
import type { Metadata } from "next";

import { WaitlistForm } from "@/components/waitlist-form";

export const metadata: Metadata = {
  title: "AI Production Kit — metering, spend caps, and an eval gate in CI",
  description:
    "Token metering wired Postgres-atomic, a per-tenant spend cap with a circuit breaker, and an eval harness that fails the PR on regression. The production-rigor layer cheap AI boilerplate skips.",
};

const MODULES = [
  {
    glyph: "▦",
    label: "Token metering",
    body: "Usage writes in the same transaction as the result — one atomic increment, so concurrent calls never double-count a charge or drop one under load.",
  },
  {
    glyph: "⊘",
    label: "Spend caps + circuit breaker",
    body: "Each tenant gets a hard cap. Cross it and the breaker opens — the next model call returns HTTP 402 and resets on the window, not a surprise invoice.",
  },
  {
    glyph: "▣",
    label: "Eval harness in CI",
    body: "Prompts run against a golden set on every pull request. A score drop past tolerance fails the check — the regression never reaches a customer.",
  },
  {
    glyph: "▤",
    label: "Prompt registry",
    body: "Every prompt is versioned and addressable by id. A call references prompt@v7, not an inline string — diff it, roll it back, audit what the model was asked.",
  },
  {
    glyph: "▥",
    label: "Guardrails",
    body: "Input and output cross a Zod-typed schema and a policy check on both sides of the model. Out-of-policy responses are rejected at the boundary, not forwarded.",
  },
  {
    glyph: "▧",
    label: "Agent setup",
    body: "Typed agent and tool definitions with a per-tool allowlist. An agent calls only the tools its manifest declares — no implicit access, no surprise side-effect.",
  },
];

const SKUS = [
  ["One-time", "Buy the AI Production Kit outright and own the source."],
  ["Per-module", "Take metering, caps, or the eval harness on its own."],
  ["Bundle", "The kit with the base and every edition, one purchase."],
  [
    "Developer plan",
    "Subscription — credits, framework updates, private-registry pulls.",
  ],
];

export default function AiKitPage() {
  return (
    <>
      {/* ===== Hero: lead with the spike that gets capped ===== */}
      <section className="cs-section cs-section--flush">
        <div className="cs-container">
          <span className="cs-eyebrow">AI Production Kit · Edition #2</span>
          <h1
            style={{
              fontSize: "var(--cs-text-display)",
              lineHeight: "var(--cs-leading-tight)",
              letterSpacing: "var(--cs-tracking-tighter)",
              fontWeight: "var(--cs-weight-semibold)",
              margin: "var(--cs-space-5) 0 var(--cs-space-4)",
              maxWidth: "18ch",
            }}
          >
            The spike hits a cap, not your invoice.
          </h1>
          <p className="cs-lede" style={{ maxWidth: "64ch" }}>
            An unmetered loop, an eval regression shipped on a Friday, a prompt
            nobody can audit — the three ways an AI feature turns into an
            incident. This kit puts a control in front of each one: atomic
            metering, a per-tenant breaker, and an eval gate in CI.
          </p>
          <div
            style={{
              display: "flex",
              gap: "var(--cs-space-3)",
              marginTop: "var(--cs-space-8)",
              flexWrap: "wrap",
            }}
          >
            <Link href="#waitlist" className="cs-btn cs-btn--primary">
              Request early access
            </Link>
            <Link href="/docs" className="cs-btn cs-btn--ghost">
              Read the docs
            </Link>
          </div>

          {/* Evidence over adjectives: the runaway spike, then the breaker that catches it. */}
          <pre
            className="cs-code"
            style={{ marginTop: "var(--cs-space-12)", maxWidth: "62ch" }}
            aria-label="Example: a runaway token spike trips the per-tenant circuit breaker"
          >
            {`$ caisson ai spend --watch
14:02  acme     412k tok   within cap
14:09  acme   4,812k tok   9.6x median   runaway loop
14:09  BREAKER OPEN — acme over hard cap
       next model call -> HTTP 402, resets 00:00 UTC`}
          </pre>
        </div>
      </section>

      {/* ===== The named failure ===== */}
      <section className="cs-section">
        <div className="cs-container">
          <span className="cs-eyebrow">The failure mode</span>
          <h2 className="cs-section-title">
            Cheap AI boilerplate ships the demo, not the controls.
          </h2>
          <p className="cs-lede">
            A starter that calls the model is a demo. The gap between that and a
            feature you can run for paying tenants is metering, caps, evals, and
            a registry — the parts that only matter once real traffic and a real
            invoice arrive. This kit is that gap, wired and tested.
          </p>
        </div>
      </section>

      {/* ===== Modules ===== */}
      <section className="cs-section">
        <div className="cs-container">
          <span className="cs-eyebrow">What ships in the box</span>
          <h2 className="cs-section-title">
            Six controls between your model and an incident.
          </h2>
          <div
            className="cs-grid cs-grid--3"
            style={{ marginTop: "var(--cs-space-8)" }}
          >
            {MODULES.map((m) => (
              <article key={m.label} className="cs-card">
                <div className="cs-status">
                  <span className="glyph" aria-hidden="true">
                    {m.glyph}
                  </span>
                  {m.label}
                </div>
                <p
                  className="cs-muted"
                  style={{ marginTop: "var(--cs-space-3)" }}
                >
                  {m.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Rigor, not theater ===== */}
      <section className="cs-section">
        <div className="cs-container">
          <span className="cs-eyebrow">Rigor, not theater</span>
          <h2 className="cs-section-title">
            Every claim here is a control you can point at.
          </h2>
          <p className="cs-lede">
            The caps, the breaker, and the eval gate are configuration checked
            into your repo and enforced at call time — not a dashboard you hope
            someone is watching. Here is the policy that backs the hero above.
          </p>
          <pre
            className="cs-code"
            style={{ marginTop: "var(--cs-space-8)", maxWidth: "62ch" }}
            aria-label="Example caisson.ai.toml: spend caps and the CI eval gate as code"
          >
            {`# caisson.ai.toml — checked into your repo, enforced at call time
[caps.default]
daily_tokens = 1_000_000
on_exceed    = "break"   # open the circuit, return 402

[evals]
gate         = "ci"      # block the PR on regression
tolerance    = 0.02      # max score drop before the check fails`}
          </pre>
        </div>
      </section>

      {/* ===== SKU structure (no prices — pricing fork open, ADR-0048) ===== */}
      <section className="cs-section">
        <div className="cs-container">
          <span className="cs-eyebrow">How it&apos;s sold</span>
          <h2 className="cs-section-title">Own the code, or subscribe.</h2>
          <div
            className="cs-grid cs-grid--4"
            style={{ marginTop: "var(--cs-space-8)" }}
          >
            {SKUS.map(([title, body]) => (
              <article key={title} className="cs-card">
                <div className="cs-card-title">{title}</div>
                <p
                  className="cs-muted"
                  style={{ marginTop: "var(--cs-space-2)" }}
                >
                  {body}
                </p>
                <p
                  className="cs-footnote"
                  style={{ marginTop: "var(--cs-space-4)" }}
                >
                  Early access — join the waitlist
                </p>
              </article>
            ))}
          </div>
          <p className="cs-footnote" style={{ marginTop: "var(--cs-space-6)" }}>
            Pricing is set at early access —{" "}
            <Link href="/pricing" style={{ color: "var(--cs-link)" }}>
              see the full lineup
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ===== Waitlist ===== */}
      <section className="cs-section" id="waitlist">
        <div className="cs-container">
          <span className="cs-eyebrow">Early access</span>
          <h2 className="cs-section-title">
            Ship the feature with the brakes on.
          </h2>
          <p className="cs-lede" style={{ marginBottom: "var(--cs-space-6)" }}>
            Join the early-access list. We&apos;ll reach out as the kit opens.
          </p>
          <WaitlistForm source="ai-kit" />
        </div>
      </section>
    </>
  );
}
