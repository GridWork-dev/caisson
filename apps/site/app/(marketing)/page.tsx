import Link from "next/link";
import type { Metadata } from "next";

import { WaitlistForm } from "@/components/waitlist-form";

export const metadata: Metadata = {
  title: "Compliance-grade infrastructure for regulated SaaS",
  description:
    "Fail-closed Postgres RLS, S3 Object-Lock WORM, and an append-only audit chain — wired and tested before your first customer, not backfilled after your first audit.",
};

const EVIDENCE = [
  {
    glyph: "▣",
    label: "Fail-closed RLS",
    body: "Postgres row-level security with FORCE — a query with no tenant context returns nothing, never everything. Cross-tenant isolation is a test, not a hope.",
  },
  {
    glyph: "▤",
    label: "WORM storage",
    body: "S3 Object-Lock in compliance mode. Evidence objects cannot be altered or deleted before retention expires — not by an admin, not by a leaked key.",
  },
  {
    glyph: "▥",
    label: "Append-only audit chain",
    body: "Every privileged action hashes into a SHA-256 chain. Tampering breaks the link; the break is detectable and provable.",
  },
];

const EDITIONS = [
  {
    href: "/compliance",
    name: "Compliance",
    tag: "Hero",
    line: "Fail-closed RLS, S3 WORM, append-only audit chain, per-tenant field encryption, and a SOC2/HIPAA evidence-pack generator.",
  },
  {
    href: "/ai-kit",
    name: "AI Production Kit",
    tag: "#2",
    line: "The production-rigor layer cheap AI boilerplate skips: token metering, spend caps, a circuit breaker, an eval harness in CI, and guardrails.",
  },
  {
    href: "/local-first",
    name: "Local-first AI",
    tag: "Free · AGPL",
    line: "Compute seam, privacy gate, and on-device vector search. Your data never leaves the device. Open-core under AGPL.",
  },
  {
    href: "/agentic-dev",
    name: "Agentic-Dev",
    tag: "Roadmap",
    line: "The governed-agent kernel: typed agent/skill/rule schema, a lifecycle state machine, and a hooks dispatcher.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* ===== Hero ===== */}
      <section className="cs-section cs-section--flush">
        <div className="cs-container">
          <span className="cs-eyebrow">
            Compliance-grade infrastructure for regulated SaaS
          </span>
          <h1
            style={{
              fontSize: "var(--cs-text-display)",
              lineHeight: "var(--cs-leading-tight)",
              letterSpacing: "var(--cs-tracking-tighter)",
              fontWeight: "var(--cs-weight-semibold)",
              margin: "var(--cs-space-5) 0 var(--cs-space-4)",
              maxWidth: "16ch",
            }}
          >
            Fail-closed by construction.
          </h1>
          <p className="cs-lede" style={{ maxWidth: "64ch" }}>
            Fail-closed Postgres RLS, S3 Object-Lock WORM, and an append-only
            audit chain — wired and tested before your first customer, not
            backfilled after your first audit.
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

          {/* Evidence over adjectives: a real fail-closed denial, not a stock illustration. */}
          <pre
            className="cs-code"
            style={{ marginTop: "var(--cs-space-12)", maxWidth: "60ch" }}
            aria-label="Example: a query with no tenant context is denied by RLS"
          >
            {`$ psql -c "select * from invoices"
ERROR:  permission denied for table invoices
DETAIL: RLS policy "tenant_isolation" forbids SELECT
        with no app.tenant set — fail-closed by default.`}
          </pre>
        </div>
      </section>

      {/* ===== Umbrella / named enemy ===== */}
      <section className="cs-section">
        <div className="cs-container">
          <span className="cs-eyebrow">The umbrella</span>
          <h2 className="cs-section-title">
            The load-bearing infrastructure cheap boilerplates skip.
          </h2>
          <p className="cs-lede">
            Happy-path starter kits get you a login screen. They do not get you
            through an audit. Retrofitting RLS, WORM storage, and an audit chain
            into a <em>live</em> multi-tenant database costs months. Start with
            them.
          </p>
        </div>
      </section>

      {/* ===== Evidence row ===== */}
      <section className="cs-section">
        <div className="cs-container">
          <span className="cs-eyebrow">What ships in the box</span>
          <h2 className="cs-section-title">
            Prevention at the application layer.
          </h2>
          <div
            className="cs-grid cs-grid--3"
            style={{ marginTop: "var(--cs-space-8)" }}
          >
            {EVIDENCE.map((e) => (
              <article key={e.label} className="cs-card">
                <div className="cs-status">
                  <span className="glyph" aria-hidden="true">
                    {e.glyph}
                  </span>
                  {e.label}
                </div>
                <p
                  className="cs-muted"
                  style={{ marginTop: "var(--cs-space-3)" }}
                >
                  {e.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Editions overview ===== */}
      <section className="cs-section">
        <div className="cs-container">
          <span className="cs-eyebrow">Editions</span>
          <h2 className="cs-section-title">
            One umbrella. No orphaned modules.
          </h2>
          <p className="cs-lede">
            Compliance is the front door. Each edition is a composition of the
            same audited base — never a fork.
          </p>
          <div
            className="cs-grid cs-grid--2"
            style={{ marginTop: "var(--cs-space-8)" }}
          >
            {EDITIONS.map((ed) => (
              <Link
                key={ed.href}
                href={ed.href}
                className={
                  ed.tag === "Hero" ? "cs-card cs-card--accent" : "cs-card"
                }
                style={{ display: "block" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: "var(--cs-space-3)",
                  }}
                >
                  <span className="cs-card-title">{ed.name}</span>
                  <span className="cs-tag">{ed.tag}</span>
                </div>
                <p
                  className="cs-muted"
                  style={{ marginTop: "var(--cs-space-3)" }}
                >
                  {ed.line}
                </p>
              </Link>
            ))}
          </div>
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
            {[
              ["One-time", "Buy an edition outright and own the source."],
              ["Bundle", "All editions plus the base, one purchase."],
              ["Per-module", "Take a single module à la carte."],
              [
                "Subscription",
                "Compliance Updates or the Developer plan — credits, framework updates, private-registry pulls.",
              ],
            ].map(([title, body]) => (
              <article key={title} className="cs-card">
                <div className="cs-card-title">{title}</div>
                <p
                  className="cs-muted"
                  style={{ marginTop: "var(--cs-space-2)" }}
                >
                  {body}
                </p>
              </article>
            ))}
          </div>
          <p className="cs-footnote" style={{ marginTop: "var(--cs-space-6)" }}>
            EU AI Act Annex IV ships as an EU AI Act-ready add-on, sold
            worldwide. Pricing is set at early access —{" "}
            <Link href="/pricing" style={{ color: "var(--cs-link)" }}>
              see the full lineup
            </Link>
            .
          </p>
          <p className="cs-footnote" style={{ marginTop: "var(--cs-space-3)" }}>
            And yes — it&apos;s a better base than the $199 kits.
          </p>
        </div>
      </section>

      {/* ===== Waitlist ===== */}
      <section className="cs-section" id="waitlist">
        <div className="cs-container">
          <span className="cs-eyebrow">Early access</span>
          <h2 className="cs-section-title">Start audit-ready.</h2>
          <p className="cs-lede" style={{ marginBottom: "var(--cs-space-6)" }}>
            Join the early-access list. We&apos;ll reach out as editions open.
          </p>
          <WaitlistForm source="home-hero" />
        </div>
      </section>
    </>
  );
}
