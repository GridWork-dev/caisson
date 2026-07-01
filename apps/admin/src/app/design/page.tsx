import Link from "next/link";

import { Icon } from "@caisson/ui/components";
import type { IconName } from "@caisson/ui/components";
import { accentCandidates, selected, typeCandidates } from "@caisson/ui/tokens";

type SurfaceState = "ready" | "later" | "locked";

interface Surface {
  title: string;
  desc: string;
  state: SurfaceState;
  href?: string;
}

const SURFACES: Surface[] = [
  {
    title: "Foundations",
    desc: "Palette candidates, swatches, contrast read-out.",
    state: "ready",
    href: "/design/foundations",
  },
  {
    title: "Typography",
    desc: "Type pairings, modular scale, mono specimen.",
    state: "ready",
    href: "/design/typography",
  },
  {
    title: "Voice",
    desc: "Tagline, hero copy, banned list, locked in specs/04.",
    state: "locked",
  },
  {
    title: "Wordmark",
    desc: "Pressure vessel — the locked mark (ADR-0103). Candidates kept for the record.",
    state: "locked",
    href: "/design/wordmark",
  },
  {
    title: "Components",
    desc: "The @caisson/ui kit, rendered live (ADR-0099 recipe).",
    state: "ready",
    href: "/design/components",
  },
  {
    title: "Signature",
    desc: "Four-beat motion sketch — deferred for rework; leaves a blank slot on the site.",
    state: "later",
  },
];

// ADR-0078 §3: one icon surface, never ad-hoc Unicode glyphs.
const GLYPH: Record<SurfaceState, IconName> = {
  ready: "circle-dot",
  locked: "lock",
  later: "circle",
};
const STATE_LABEL: Record<SurfaceState, string> = {
  ready: "ready",
  locked: "locked",
  later: "later",
};

export default function HubPage() {
  const palette = accentCandidates.find((c) => c.id === selected.palette);
  const type = typeCandidates.find((c) => c.id === selected.type);

  return (
    <div className="shell stack" style={{ gap: "var(--cs-space-12)" }}>
      <section>
        <p className="eyebrow">caisson · design studio</p>
        <h1 className="page-title" style={{ maxWidth: "18ch" }}>
          The foundation, decided in the open.
        </h1>
        <p className="lede">
          A pressurized steel caisson sunk in cold harbor water: wet dark steel,
          a single instrument light, holds under load. Each foundational choice
          is rendered as live candidates here, picked once, then locked into the
          token contract every Caisson surface inherits.
        </p>
        <div className="row" style={{ marginTop: "var(--cs-space-6)" }}>
          <span className="badge">
            palette · {palette?.name ?? selected.palette}
          </span>
          <span className="badge">type · {type?.name ?? selected.type}</span>
          <span className="badge">wcag · AA floor</span>
        </div>
      </section>

      <section className="stack" style={{ gap: "var(--cs-space-4)" }}>
        <h2 className="section-title">Surfaces</h2>
        <ul className="board">
          {SURFACES.map((s) => {
            const inner = (
              <>
                <span className="board-glyph" data-state={s.state}>
                  <Icon name={GLYPH[s.state]} />
                </span>
                <span className="board-main">
                  <span className="board-title">{s.title}</span>
                  <span className="board-desc muted">{s.desc}</span>
                </span>
                <span className="board-state mono">{STATE_LABEL[s.state]}</span>
                {s.href ? (
                  <span className="board-arrow">
                    <Icon name="arrow" />
                  </span>
                ) : null}
              </>
            );
            return (
              <li
                key={s.title}
                className="board-row"
                data-interactive={s.href ? "true" : undefined}
              >
                {s.href ? (
                  <Link href={s.href} className="board-link">
                    {inner}
                  </Link>
                ) : (
                  <div className="board-link is-static">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
