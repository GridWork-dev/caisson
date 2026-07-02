import Link from "next/link";

import { Icon } from "@caisson/ui/components";
import type { IconName } from "@caisson/ui/components";

// The control-plane home: one card per ADR-0138 section. "ready" surfaces are linked; "soon" ones
// land as tasks A4-A7 ship (business/ops/architecture/decisions). Reuses the absorbed studio's
// `.board` chrome (globals.css) so the whole app shares one vocabulary.
type SectionState = "ready" | "soon";

interface Section {
  title: string;
  desc: string;
  state: SectionState;
  href?: string;
}

const SECTIONS: Section[] = [
  {
    title: "Design system",
    desc: "Token foundations, type, wordmark, and the live @caisson/ui kit (the absorbed studio).",
    state: "ready",
    href: "/design",
  },
  {
    title: "Ops & observability",
    desc: "Fleet health + Grafana-backed telemetry widgets, with deep-links to the full traces.",
    state: "soon",
  },
  {
    title: "Business admin",
    desc: "Tenants, purchases, entitlements, and credits over the Railway Postgres (read-only).",
    state: "soon",
  },
  {
    title: "Architecture",
    desc: "The live service/deploy topology, derived from the manifests + health probes.",
    state: "soon",
  },
  {
    title: "Decisions / SOT",
    desc: "The forks board and the ADR trail, rendered — the control-plane is itself a source of truth.",
    state: "soon",
  },
];

const GLYPH: Record<SectionState, IconName> = {
  ready: "circle-dot",
  soon: "circle",
};
const STATE_LABEL: Record<SectionState, string> = {
  ready: "ready",
  soon: "soon",
};

export default function OverviewPage() {
  return (
    <div className="shell stack" style={{ gap: "var(--cs-space-12)" }}>
      <section>
        <p className="eyebrow">caisson · admin</p>
        <h1 className="page-title" style={{ maxWidth: "20ch" }}>
          One operator cockpit for the whole fleet.
        </h1>
        <p className="lede">
          Ops, business state, the live architecture, the decisions record, and
          the design system — the four surfaces you used to toggle between,
          collapsed behind one Access-gated app that is also the source of truth
          it describes.
        </p>
      </section>

      <section className="stack" style={{ gap: "var(--cs-space-4)" }}>
        <h2 className="section-title">Sections</h2>
        <ul className="board">
          {SECTIONS.map((s) => {
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
