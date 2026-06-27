import type { Metadata } from "next";

import { WaitlistForm } from "@/components/waitlist-form";

export const metadata: Metadata = {
  title: "Agentic-Dev — a governed-agent kernel (Roadmap)",
  description:
    "A governed-agent kernel: a typed agent/skill/rule schema, a lifecycle state machine, local hybrid memory, and a hooks dispatcher. Post-wedge — on the roadmap, not yet shipped.",
};

const PIECES = [
  {
    glyph: "▤",
    label: "Typed agent / skill / rule schema",
    body: "Every agent, skill, and rule is a declared file — model lane, allowed tools, capability, side-effect flag. Validated against a schema at load. No agent grants itself a tool it did not declare.",
  },
  {
    glyph: "▥",
    label: "Lifecycle state machine",
    body: "Work moves SPEC → PLAN → EXECUTE → VERIFY → SWEEP → SHIP. Transitions are guarded: VERIFY fails, the machine reopens PLAN — there is no edge to SHIP. The path is the policy.",
  },
  {
    glyph: "▦",
    label: "Local hybrid memory",
    body: "Recall is vector + full-text over a local store, scoped per project. Reads are always allowed; writes honor a per-session mode. Secrets are never a memory item — they source from env, not recall.",
  },
  {
    glyph: "▧",
    label: "Hooks dispatcher",
    body: "Lifecycle events fire typed hooks — session-start recall, per-act logging, pre-commit gates. The dispatcher is the one audited seam; a hook cannot reach a credential the kernel did not hand it.",
  },
];

export default function AgenticDevPage() {
  return (
    <>
      {/* ===== Hero (Roadmap / post-wedge) ===== */}
      <section className="cs-section cs-section--flush">
        <div className="cs-container">
          <span className="cs-eyebrow">Agentic-Dev edition</span>
          <p className="cs-status" style={{ marginTop: "var(--cs-space-4)" }}>
            <span className="glyph" aria-hidden="true">
              ◷
            </span>
            Roadmap — post-wedge, not yet shipped
          </p>
          <h1
            style={{
              fontSize: "var(--cs-text-display)",
              lineHeight: "var(--cs-leading-tight)",
              letterSpacing: "var(--cs-tracking-tighter)",
              fontWeight: "var(--cs-weight-semibold)",
              margin: "var(--cs-space-4) 0 var(--cs-space-4)",
              maxWidth: "18ch",
            }}
          >
            A governed-agent kernel.
          </h1>
          <p className="cs-lede" style={{ maxWidth: "64ch" }}>
            Agents that declare their model lane, their tools, and their blast
            radius up front — and a lifecycle that refuses to ship work that did
            not pass verify. The boundary is written down, not assumed.
          </p>

          {/* Evidence over adjectives: a typed agent declaration, not a claim. */}
          <pre
            className="cs-code"
            style={{ marginTop: "var(--cs-space-12)", maxWidth: "60ch" }}
            aria-label="Example: a typed agent declaration with a declared boundary"
          >
            {`# agents/db-migrator.agent.yaml
name:         db-migrator
capability:   code_write
model:        sonnet         # a lane, not a default to the top tier
tools:        [read, edit, run-tests]
side_effects: false          # cannot push, deploy, or read a secret
gate:         human-approval  # data-migration tag → operator re-entry`}
          </pre>
        </div>
      </section>

      {/* ===== The pieces ===== */}
      <section className="cs-section">
        <div className="cs-container">
          <span className="cs-eyebrow">What the kernel is made of</span>
          <h2 className="cs-section-title">
            Four parts, each a declared seam.
          </h2>
          <p className="cs-lede">
            No part is a black box. Each is a file you can read, diff, and gate
            in review before an agent ever runs.
          </p>
          <div
            className="cs-grid cs-grid--2"
            style={{ marginTop: "var(--cs-space-8)" }}
          >
            {PIECES.map((p) => (
              <article key={p.label} className="cs-card">
                <div className="cs-status">
                  <span className="glyph" aria-hidden="true">
                    {p.glyph}
                  </span>
                  {p.label}
                </div>
                <p
                  className="cs-muted"
                  style={{ marginTop: "var(--cs-space-3)" }}
                >
                  {p.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Framing: governed kernel, not autonomous magic ===== */}
      <section className="cs-section">
        <div className="cs-container">
          <span className="cs-eyebrow">The framing</span>
          <h2 className="cs-section-title">
            A governed kernel, not autonomous magic.
          </h2>
          <p className="cs-lede">
            The kernel does not make agents smarter. It makes them accountable:
            every dispatch declares its lane and its boundary, the kernel holds
            the credentials, and the lifecycle owns the path to ship. An agent
            that wants to deploy cannot — that capability lives on one audited
            side of the seam.
          </p>

          {/* Evidence: the boundary expressed as a dispatch, not an adjective. */}
          <pre
            className="cs-code"
            style={{ marginTop: "var(--cs-space-8)", maxWidth: "60ch" }}
            aria-label="Example: a dispatch declaring its lane and boundary"
          >
            {`dispatch({
  agent:       "db-migrator",
  model:       "sonnet",     // escalate to opus only on uncertainty
  isolation:   "worktree",   // parallel writers never share a tree
  side_effects: false,       // the kernel owns secrets, not the agent
});
// VERIFY fails → the state machine reopens PLAN. No edge to SHIP.`}
          </pre>
        </div>
      </section>

      {/* ===== SKU structure (no prices — pricing fork open, ADR-0048) ===== */}
      <section className="cs-section">
        <div className="cs-container">
          <span className="cs-eyebrow">How it&apos;s sold</span>
          <h2 className="cs-section-title">A composition of the same base.</h2>
          <p className="cs-lede">
            Agentic-Dev is an edition, not a fork — built on the audited base
            every other edition shares. It opens after the Compliance wedge
            lands.
          </p>
          <div
            className="cs-grid cs-grid--3"
            style={{ marginTop: "var(--cs-space-8)" }}
          >
            {[
              ["One-time", "Buy the edition outright and own the source."],
              ["Per-module", "Take the kernel à la carte onto your base."],
              [
                "Developer plan",
                "Subscription — credits, framework updates, private-registry pulls.",
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
                <p
                  className="cs-footnote"
                  style={{ marginTop: "var(--cs-space-3)" }}
                >
                  Early access — join the waitlist
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Waitlist ===== */}
      <section className="cs-section" id="waitlist">
        <div className="cs-container">
          <span className="cs-eyebrow">Early access</span>
          <h2 className="cs-section-title">Get the kernel when it opens.</h2>
          <p className="cs-lede" style={{ marginBottom: "var(--cs-space-6)" }}>
            Agentic-Dev is on the roadmap, post-wedge. Join the list and
            we&apos;ll reach out when it ships.
          </p>
          <WaitlistForm source="agentic-dev" />
        </div>
      </section>
    </>
  );
}
