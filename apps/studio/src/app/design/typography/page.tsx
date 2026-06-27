import { foundation, typeCandidates } from "@caisson/ui/tokens";
import type { TypeCandidate } from "@caisson/ui/tokens";

const WEIGHTS: ReadonlyArray<readonly [number, string]> = [
  [300, "Light"],
  [400, "Regular"],
  [500, "Medium"],
  [600, "Semibold"],
  [700, "Bold"],
];

const SCALE_STEPS = Object.entries(foundation.fontSize);

function Specimen({ c }: { c: TypeCandidate }) {
  return (
    <article className={`panel${c.recommended ? " is-rec" : ""}`}>
      <div className="panel-head">
        <div>
          <h3>
            <span className="mono" style={{ color: "var(--cs-fg-muted)" }}>
              {c.id}
            </span>{" "}
            {c.name}
          </h3>
          <p className="panel-blurb">{c.blurb}</p>
        </div>
        {c.recommended ? (
          <span className="badge is-rec">recommended</span>
        ) : null}
      </div>

      <div
        className="spec-display"
        style={{
          fontFamily: c.sans,
          fontWeight: 600,
          letterSpacing: "-0.03em",
        }}
      >
        Fail-closed by construction.
      </div>

      <div className="weight-ladder" style={{ fontFamily: c.sans }}>
        {WEIGHTS.map(([w, label]) => (
          <div key={w} className="weight-row">
            <span style={{ fontWeight: w, fontSize: "var(--cs-text-xl)" }}>
              Caisson
            </span>
            <span className="mono weight-tag">
              {w} · {label}
            </span>
          </div>
        ))}
      </div>

      <p className="spec-body" style={{ fontFamily: c.sans, fontWeight: 350 }}>
        Retrofitting RLS, WORM storage, and an append-only audit chain into a
        live multi-tenant database costs months. Compliance-grade infrastructure
        for regulated SaaS, wired and tested before your first customer, not
        backfilled after your first audit.
      </p>

      <div className="spec-mono" style={{ fontFamily: c.mono }}>
        <span style={{ color: "var(--cs-fg-muted)" }}>--cs-accent</span>:
        oklch(0.74 0.115 205);
        <br />
        <span style={{ color: "var(--cs-fg-muted)" }}>account_id</span> ={" "}
        <span style={{ color: "var(--cs-accent)" }}>SET LOCAL</span> · 402 ·
        timingSafeEqual()
      </div>
    </article>
  );
}

export default function TypographyPage() {
  const rec = typeCandidates.find((c) => c.recommended) ?? typeCandidates[0];
  return (
    <div className="shell stack" style={{ gap: "var(--cs-space-8)" }}>
      <section>
        <p className="eyebrow">typography · the type fork</p>
        <h1 className="page-title">Type</h1>
        <p className="lede">
          Picked for Caisson as a physical object (engineered, exact,
          load-bearing), past the training-default families. Mono carries
          evidence (token names, audit artifacts), never costume. Recommended:
          1.
        </p>
      </section>

      <section
        className="cols"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))" }}
      >
        {typeCandidates.map((c) => (
          <Specimen key={c.id} c={c} />
        ))}
      </section>

      <hr className="divider" />

      <section className="stack" style={{ gap: "var(--cs-space-4)" }}>
        <div>
          <h2 className="section-title">Modular scale</h2>
          <p className="muted" style={{ fontSize: "var(--cs-text-sm)" }}>
            Ratio ~1.25, fluid clamp() on display. Shown in{" "}
            {rec?.name ?? "the recommended"} sans.
          </p>
        </div>
        <div
          className="stack"
          style={{ gap: "var(--cs-space-3)", fontFamily: rec?.sans }}
        >
          {SCALE_STEPS.map(([name, value]) => (
            <div key={name} className="scale-row">
              <span className="scale-label mono">{name}</span>
              <span className="scale-sample" style={{ fontSize: value }}>
                Holds under load
              </span>
              <span className="scale-val mono muted">{value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
