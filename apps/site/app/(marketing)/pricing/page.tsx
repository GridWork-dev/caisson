import type { Metadata } from "next";

import { WaitlistForm } from "@/components/waitlist-form";

export const metadata: Metadata = {
  title: "Pricing — own the code, or subscribe",
  description:
    "The Caisson SKU structure: editions one-time, a bundle, per-module à la carte, and two subscriptions. Pricing is set at early access — join the waitlist.",
};

// Pricing-numbers fork is open (ADR-0048): show SKU STRUCTURE only, never a number.
const EDITIONS = [
  {
    name: "Compliance",
    accent: true,
    tag: "Hero",
    summary:
      "The audit-ready substrate: prevention wired at the application layer before your first customer.",
    includes: [
      "Fail-closed Postgres RLS (FORCE) with cross-tenant isolation tests",
      "S3 Object-Lock WORM evidence store, compliance mode",
      "Append-only SHA-256 audit chain — tamper breaks the link",
      "Per-tenant field encryption with per-tenant keys",
      "SOC2 / HIPAA evidence-pack generator",
    ],
  },
  {
    name: "AI Production Kit",
    accent: false,
    tag: "#2",
    summary:
      "The production-rigor layer cheap AI boilerplate skips — metered, capped, and tested in CI.",
    includes: [
      "Provider-agnostic config + PG-atomic token metering",
      "Spend caps and a per-tenant circuit breaker",
      "Eval harness that runs in CI, not in prod",
      "Prompt registry + input/output guardrails",
      "Agent-setup config bundles",
    ],
  },
  {
    name: "Local-first AI",
    accent: false,
    tag: "Free · AGPL",
    summary:
      "The open-core flank. Your data never leaves the device. Free under AGPL; pay only for the license kit + credits.",
    includes: [
      "Compute seam — same code, on-device or hosted",
      "Privacy gate enforcing the no-egress boundary",
      "sqlite-vec ANN for on-device vector search",
      "Offline license + local store",
      "AGPL core — fork it, run it, ship it",
    ],
  },
  {
    name: "Agentic-Dev",
    accent: false,
    tag: "Roadmap",
    summary:
      "The governed-agent kernel. Building in the open; the schema and state machine are locked.",
    includes: [
      "Typed agent / skill / rule schema",
      "Lifecycle state machine for governed runs",
      "Hooks dispatcher for side-effect consolidation",
      "Capability → agent routing",
    ],
  },
];

const COMMERCE = [
  [
    "One-time",
    "Buy an edition outright. You own the source — fork it, ship it, keep it.",
  ],
  ["Bundle", "Every edition plus the base, one purchase, one discount."],
  [
    "Per-module",
    "Take a single module à la carte — auth, billing, credits, audit-WORM, guardrails.",
  ],
  [
    "Subscription",
    "Recurring updates + credits layered on any one-time purchase. Two SKUs below.",
  ],
];

const SUBSCRIPTIONS = [
  {
    name: "Compliance Updates",
    audience: "For the team that has to pass the audit again next year.",
    includes: [
      "Auto-updating control mappings — SOC2, HIPAA, EU AI Act, DORA, NIS2, state-privacy",
      "Evidence-pack regeneration on every framework revision",
      "New-framework slots as regulations land",
      "Control-drift alerts when a mapping goes stale",
      "Compliance support SLA",
    ],
  },
  {
    name: "Developer",
    audience: "For the team building on the base every week.",
    includes: [
      "Monthly codegen + AI-feature credit allotment",
      "Framework and module updates as they ship",
      "Private-registry pulls, entitlement-scoped",
      "New-edition access on release",
      "Priority developer support",
    ],
  },
];

// Every price slot reads the same — no number anywhere (ADR-0048).
function EarlyAccess() {
  return (
    <div className="cs-status" style={{ marginTop: "var(--cs-space-4)" }}>
      <span className="glyph" aria-hidden="true">
        ○
      </span>
      Early access — join the waitlist
    </div>
  );
}

function Includes({ items }: { items: readonly string[] }) {
  return (
    <ul
      style={{
        margin: "var(--cs-space-4) 0 0",
        padding: 0,
        listStyle: "none",
        display: "grid",
        gap: "var(--cs-space-2)",
      }}
    >
      {items.map((item) => (
        <li
          key={item}
          className="cs-muted"
          style={{
            display: "flex",
            gap: "var(--cs-space-2)",
            fontSize: "var(--cs-text-sm)",
            lineHeight: "var(--cs-leading-snug)",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              color: "var(--cs-accent)",
              fontFamily: "var(--cs-font-mono)",
            }}
          >
            +
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PricingPage() {
  return (
    <>
      {/* ===== Hero ===== */}
      <section className="cs-section cs-section--flush">
        <div className="cs-container">
          <span className="cs-eyebrow">Pricing</span>
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
            Own the code, or subscribe.
          </h1>
          <p className="cs-lede" style={{ maxWidth: "64ch" }}>
            Buy an edition outright and own the source. Or subscribe for the
            updates that keep it audit-ready. The structure is locked; numbers
            are set at early access.
          </p>

          {/* Evidence over adjectives: the SKU structure is a real entitlement set, not a price grid. */}
          <pre
            className="cs-code"
            style={{ marginTop: "var(--cs-space-10)", maxWidth: "60ch" }}
            aria-label="Example: the entitlement set behind a Caisson account"
          >
            {`$ caisson entitlements
edition.compliance        owned     one-time
sub.compliance-updates    active    control-mappings @ 2026.6
sub.developer             active    private-registry + credits
addon.eu-ai-act           available registry-gated`}
          </pre>
        </div>
      </section>

      {/* ===== Edition lineup ===== */}
      <section className="cs-section">
        <div className="cs-container">
          <span className="cs-eyebrow">Editions</span>
          <h2 className="cs-section-title">Four editions, one audited base.</h2>
          <p className="cs-lede">
            Each edition is a composition of the same substrate — never a fork.
            Compliance is the front door.
          </p>
          <div
            className="cs-grid cs-grid--2"
            style={{ marginTop: "var(--cs-space-8)" }}
          >
            {EDITIONS.map((ed) => (
              <article
                key={ed.name}
                className={ed.accent ? "cs-card cs-card--accent" : "cs-card"}
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
                  {ed.summary}
                </p>
                <Includes items={ed.includes} />
                <EarlyAccess />
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Commerce model ===== */}
      <section className="cs-section">
        <div className="cs-container">
          <span className="cs-eyebrow">How it&apos;s sold</span>
          <h2 className="cs-section-title">Four ways to buy. No lock-in.</h2>
          <p className="cs-lede">
            One-time for ownership, a bundle for the whole library, modules for
            the one piece you need, a subscription for what keeps shipping.
          </p>
          <div
            className="cs-grid cs-grid--4"
            style={{ marginTop: "var(--cs-space-8)" }}
          >
            {COMMERCE.map(([title, body]) => (
              <article key={title} className="cs-card">
                <div className="cs-card-title">{title}</div>
                <p
                  className="cs-muted"
                  style={{
                    marginTop: "var(--cs-space-2)",
                    fontSize: "var(--cs-text-sm)",
                  }}
                >
                  {body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Subscriptions ===== */}
      <section className="cs-section">
        <div className="cs-container">
          <span className="cs-eyebrow">Subscriptions</span>
          <h2 className="cs-section-title">Two recurring SKUs, two jobs.</h2>
          <p className="cs-lede">
            Compliance Updates keeps the control mappings current. The Developer
            plan keeps your build fed. Buy either, both, or neither.
          </p>
          <div
            className="cs-grid cs-grid--2"
            style={{ marginTop: "var(--cs-space-8)" }}
          >
            {SUBSCRIPTIONS.map((sub) => (
              <article key={sub.name} className="cs-card">
                <span className="cs-card-title">{sub.name}</span>
                <p
                  className="cs-muted"
                  style={{
                    marginTop: "var(--cs-space-3)",
                    fontSize: "var(--cs-text-sm)",
                  }}
                >
                  {sub.audience}
                </p>
                <Includes items={sub.includes} />
                <EarlyAccess />
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ===== EU AI Act gated add-on ===== */}
      <section className="cs-section">
        <div className="cs-container">
          <span className="cs-eyebrow">Add-on</span>
          <h2 className="cs-section-title">EU AI Act-ready, sold worldwide.</h2>
          <p className="cs-lede">
            Annex IV technical documentation ships as an entitlement-gated
            module — à la carte, or inside Compliance Updates. The Act binds the
            buyer&apos;s regulator, not the buyer&apos;s geography, so it sells
            everywhere. v1 leads US frameworks; the EU slot is wired and
            waiting.
          </p>
          <article
            className="cs-card"
            style={{ marginTop: "var(--cs-space-6)", maxWidth: "60ch" }}
          >
            <div className="cs-status">
              <span className="glyph" aria-hidden="true">
                ▤
              </span>
              addon.eu-ai-act — registry-gated, entitlement-scoped
            </div>
            <p
              className="cs-muted"
              style={{
                marginTop: "var(--cs-space-3)",
                fontSize: "var(--cs-text-sm)",
              }}
            >
              The code ships behind the registry token, not a checkout flag —
              stronger than a feature switch. Authored when demand shows; the
              named slot exists today.
            </p>
            <EarlyAccess />
          </article>
        </div>
      </section>

      {/* ===== Waitlist ===== */}
      <section className="cs-section" id="waitlist">
        <div className="cs-container">
          <span className="cs-eyebrow">Early access</span>
          <h2 className="cs-section-title">Numbers land with the invite.</h2>
          <p className="cs-lede" style={{ marginBottom: "var(--cs-space-6)" }}>
            Join the early-access list. We&apos;ll send pricing and an editions
            walkthrough as each one opens.
          </p>
          <WaitlistForm source="pricing" />
          <p className="cs-footnote" style={{ marginTop: "var(--cs-space-8)" }}>
            And yes — it&apos;s a better base than the $199 kits.
          </p>
        </div>
      </section>
    </>
  );
}
