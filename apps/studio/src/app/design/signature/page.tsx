import { StatusChip } from "@caisson/ui/components";

import { CaissonCrossSection } from "./caisson-cross-section";
import { BreakTheChain } from "./break-the-chain";

/**
 * Signature — the still sketch of the marketing four-beat (deny → chain → hold → sign, ADR-0102).
 * Motion is Phase 2 (on apps/site); THIS is the Phase-1 design-direction surface the kickoff asks
 * for ("sketch the hero/diagram in studio before the site rebuild"). Everything is tokenized inline
 * SVG reading only var(--cs-*) — the ADR-0078 §6 craft floor — and honors ADR-0080 §3: the diagrams
 * show GENERATED evidence, never imply Caisson is itself certified.
 */

interface Beat {
  key: string;
  n: string;
  title: string;
  line: string;
  state: string;
  here?: boolean;
}

const BEATS: Beat[] = [
  {
    key: "deny",
    n: "01",
    title: "Deny",
    line: "Fail-closed RLS: the psql denial reveals line-by-line. Above the fold.",
    state: "evolve shipped",
  },
  {
    key: "chain",
    n: "02",
    title: "Chain",
    line: "Edit one block; its hash recomputes and every link after it breaks danger-red.",
    state: "sketched ↓",
    here: true,
  },
  {
    key: "hold",
    n: "03",
    title: "Hold",
    line: "The caisson cross-section: the chamber holds the boundary under pressure.",
    state: "sketched ↓",
    here: true,
  },
  {
    key: "sign",
    n: "04",
    title: "Sign",
    line: "Control → clause map; `caisson evidence pack` materializes a signed manifest.",
    state: "phase 2",
  },
];

export default function SignaturePage() {
  return (
    <div className="shell stack" style={{ gap: "var(--cs-space-12)" }}>
      <section>
        <p className="eyebrow">caisson · signature</p>
        <h1 className="page-title" style={{ maxWidth: "20ch" }}>
          The signature, sketched.
        </h1>
        <p className="lede">
          The marketing &ldquo;wow&rdquo; is one four-beat narrative —{" "}
          <strong>deny → chain → hold → sign</strong> — rendered entirely as
          tokenized CSS + inline SVG (ADR-0102, no video pipeline). Phase 2
          builds the motion on the site; these are the stills that lock the
          direction.
        </p>
      </section>

      {/* The four beats */}
      <section className="stack" style={{ gap: "var(--cs-space-4)" }}>
        <h2 className="section-title">The four beats</h2>
        <ol
          className="cols"
          style={{ listStyle: "none", margin: 0, padding: 0 }}
        >
          {BEATS.map((b) => (
            <li
              key={b.key}
              className="panel stack"
              style={{ gap: "var(--cs-space-2)" }}
              data-here={b.here ? "" : undefined}
            >
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="board-state mono">{b.n}</span>
                <StatusChip
                  tone={b.here ? "accent" : "muted"}
                  label={b.state}
                />
              </div>
              <h3 style={{ fontSize: "var(--cs-text-xl)" }}>{b.title}</h3>
              <p className="muted" style={{ fontSize: "var(--cs-text-sm)" }}>
                {b.line}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* hold — the caisson cross-section (the signature image) */}
      <section className="stack" style={{ gap: "var(--cs-space-4)" }}>
        <h2 className="section-title">Hold · the caisson cross-section</h2>
        <p className="muted" style={{ maxWidth: "64ch" }}>
          A pressurized steel caisson sunk in cold harbor water: the working
          chamber holds the boundary while the water bears down. The metaphor is
          load-bearing — chamber = the tenant boundary, the airlock = the
          fail-closed gate, the shaft = the append-only audit chain rising to
          the surface as evidence.
        </p>
        <figure
          className="signature-frame"
          style={{ margin: 0 }}
          aria-label="Caisson cross-section diagram"
        >
          <CaissonCrossSection />
        </figure>
      </section>

      {/* chain — break the chain */}
      <section className="stack" style={{ gap: "var(--cs-space-4)" }}>
        <h2 className="section-title">Chain · break the chain</h2>
        <p className="muted" style={{ maxWidth: "64ch" }}>
          The append-only audit chain, shown mid-tamper. Edit block 03 and its
          hash recomputes; every link after it turns the reserved{" "}
          <code className="cs-tok-danger">danger</code> red and{" "}
          <code>verifyChain()</code> flips OK → FAIL. On the site this animates
          once on scroll; reduced-motion gets this broken state, static.
        </p>
        <figure
          className="signature-frame"
          style={{ margin: 0 }}
          aria-label="Audit hash-chain with a tampered block breaking every link after it"
        >
          <BreakTheChain />
        </figure>
      </section>

      <hr className="divider" />
      <p className="muted" style={{ fontSize: "var(--cs-text-sm)" }}>
        Honesty boundary (ADR-0080 §3): every beat shows evidence Caisson{" "}
        <em>generates</em> — a hash chain, a signed manifest — never a claim
        that Caisson is itself certified. Deny + Sign render as motion in Phase
        2 (Deny evolves the shipped <code>home-hero-motion</code>).
      </p>
    </div>
  );
}
