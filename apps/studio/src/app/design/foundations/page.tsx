"use client";

import { useState } from "react";

import { Icon } from "@caisson/ui/components";
import type { IconName } from "@caisson/ui/components";
import { accentCandidates, functional } from "@caisson/ui/tokens";
import type { AccentCandidate, SemanticTheme } from "@caisson/ui/tokens";

import { contrast, fmt } from "@/lib/contrast";

type Mode = "dark" | "light";

const SWATCHES: ReadonlyArray<readonly [string, keyof SemanticTheme]> = [
  ["bg", "bg"],
  ["surface-1", "surface1"],
  ["surface-2", "surface2"],
  ["border", "border"],
  ["fg", "fg"],
  ["fg-muted", "fgMuted"],
  ["accent", "accent"],
  ["accent-tint", "accentTint"],
];

// Status via the one icon surface (ADR-0078 §3), not ad-hoc Unicode glyphs.
const STATUS: ReadonlyArray<readonly [IconName, string, string]> = [
  ["check", "pass", functional.success],
  ["alert", "warn", functional.warning],
  ["x", "fail", functional.danger],
  ["info", "info", functional.info],
];

function Mockup({ t }: { t: SemanticTheme }) {
  return (
    <div
      className="mockup"
      style={{ background: t.bg, borderColor: t.border, color: t.fg }}
    >
      <div
        className="mockup-card"
        style={{ background: t.surface1, borderColor: t.border }}
      >
        <div style={{ fontWeight: 600, letterSpacing: "-0.02em" }}>
          Fail-closed by construction
        </div>
        <div style={{ color: t.fgMuted, fontSize: "var(--cs-text-sm)" }}>
          RLS, WORM, audit chain, wired before the first customer.
        </div>
        <div className="row" style={{ gap: "0.6rem", marginTop: "0.25rem" }}>
          <span
            className="btn"
            style={{
              background: t.accent,
              color: t.onAccent,
              borderColor: "transparent",
            }}
          >
            Start build
          </span>
          <span style={{ color: t.link, fontSize: "var(--cs-text-sm)" }}>
            View evidence pack →
          </span>
        </div>
        <div
          style={{
            marginTop: "0.5rem",
            background: t.accentTint,
            border: `1px solid ${t.border}`,
            borderRadius: "8px",
            padding: "0.5rem 0.7rem",
            fontFamily: "var(--cs-font-mono)",
            fontSize: "var(--cs-text-xs)",
            color: t.fg,
          }}
        >
          accent-tint surface · SET LOCAL app.account_id
        </div>
      </div>
      <div className="row" style={{ gap: "0.9rem", marginTop: "0.7rem" }}>
        {STATUS.map(([icon, label, color]) => (
          <span
            key={label}
            className="row"
            style={{ gap: "0.4ch", fontSize: "var(--cs-text-xs)" }}
          >
            <span className="row" style={{ color }}>
              <Icon name={icon} />
            </span>
            <span style={{ color: t.fgMuted }}>{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function SwatchSet({ t }: { t: SemanticTheme }) {
  return (
    <div className="swatch-grid">
      {SWATCHES.map(([label, key]) => (
        <div key={label} className="swatch">
          <span
            className="sw-chip"
            style={{ background: t[key], borderColor: t.border }}
          />
          <span className="sw-label">{label}</span>
          <span className="sw-val mono">
            {t[key].replace("oklch(", "").replace(")", "")}
          </span>
        </div>
      ))}
    </div>
  );
}

function Meters({ t }: { t: SemanticTheme }) {
  const pairs: ReadonlyArray<
    readonly [string, string, string, "body" | "large"]
  > = [
    ["fg on bg", t.fg, t.bg, "body"],
    ["fg-muted on bg", t.fgMuted, t.bg, "body"],
    ["fg-muted on surface-2", t.fgMuted, t.surface2, "body"],
    ["accent on bg", t.accent, t.bg, "large"],
    ["on-accent on accent", t.onAccent, t.accent, "body"],
    ["link on bg", t.link, t.bg, "body"],
  ];
  return (
    <div className="meters">
      {pairs.map(([label, fg, bg, kind]) => {
        const r = contrast(fg, bg);
        const ok = kind === "body" ? r.passesBody : r.passesLarge;
        return (
          <div key={label} className="meter">
            <span className="meter-label">{label}</span>
            <span className="meter-val mono">{fmt(r.ratio)}</span>
            <span
              className="meter-verdict mono"
              data-ok={ok}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4ch",
              }}
            >
              <Icon name={ok ? "check" : "x"} /> AA {kind}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function CandidatePanel({ c, mode }: { c: AccentCandidate; mode: Mode }) {
  const t = c[mode];
  return (
    <article className={`panel${c.recommended ? " is-rec" : ""}`}>
      <div className="panel-head">
        <div>
          <h3>
            <span className="mono" style={{ color: "var(--cs-fg-muted)" }}>
              {c.id.toUpperCase()}
            </span>{" "}
            {c.name}
          </h3>
          <p className="panel-blurb">{c.blurb}</p>
        </div>
        {c.recommended ? (
          <span className="badge is-rec">recommended</span>
        ) : null}
      </div>
      <Mockup t={t} />
      <SwatchSet t={t} />
      <Meters t={t} />
    </article>
  );
}

export default function FoundationsPage() {
  const [mode, setMode] = useState<Mode>("dark");
  return (
    <div className="shell stack" style={{ gap: "var(--cs-space-8)" }}>
      <section>
        <p className="eyebrow">foundations · the accent fork</p>
        <h1 className="page-title">Palette</h1>
        <p className="lede">
          Three directions, same architecture; only hue and chroma differ. Each
          renders a live mockup, its swatch set, and a WCAG read-out against the
          AA floor. Pick one; it locks into the token contract. Recommended: A.
        </p>
        <div
          className="row"
          style={{
            marginTop: "var(--cs-space-6)",
            justifyContent: "space-between",
          }}
        >
          <span className="muted" style={{ fontSize: "var(--cs-text-sm)" }}>
            Preview mode (the candidate&apos;s own theme, independent of the
            studio chrome):
          </span>
          <div className="seg" role="group" aria-label="Preview mode">
            <button
              type="button"
              aria-pressed={mode === "dark"}
              onClick={() => setMode("dark")}
            >
              Dark
            </button>
            <button
              type="button"
              aria-pressed={mode === "light"}
              onClick={() => setMode("light")}
            >
              Light
            </button>
          </div>
        </div>
      </section>

      <section
        className="cols"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))" }}
      >
        {accentCandidates.map((c) => (
          <CandidatePanel key={c.id} c={c} mode={mode} />
        ))}
      </section>
    </div>
  );
}
