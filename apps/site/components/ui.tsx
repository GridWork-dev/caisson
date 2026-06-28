// Shared presentational primitives (server-safe). The token + class contract every marketing
// surface composes against (V0.1) — extracts the byte-identical inline-style hero/section/card
// blocks that were duplicated across six page files into one reusable set. All visual values come
// from --cs-* tokens; no page should hand-roll inline display type again.
import Link from "next/link";
import type { ReactNode } from "react";

import { Icon, type IconName } from "./icon";

/* ---------- Section ---------- */
export function Section({
  eyebrow,
  title,
  lede,
  band,
  flush,
  id,
  as = "h2",
  children,
}: {
  eyebrow?: string;
  title?: ReactNode;
  lede?: ReactNode;
  /** Toned background band for section rhythm (V19). */
  band?: "tint" | "surface";
  /** Drop the top hairline (first section under the nav). */
  flush?: boolean;
  id?: string;
  /** Heading level for `title`. Use "h1" for a Section-led page's top header (one h1/page). */
  as?: "h1" | "h2";
  children?: ReactNode;
}) {
  const cls = [
    "cs-section",
    flush ? "cs-section--flush" : "",
    band === "tint" ? "cs-band--tint" : band === "surface" ? "cs-band" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const Heading = as;
  return (
    <section className={cls} id={id}>
      <div className="cs-container">
        {eyebrow && <span className="cs-eyebrow">{eyebrow}</span>}
        {title && <Heading className="cs-section-title">{title}</Heading>}
        {lede && <p className="cs-lede">{lede}</p>}
        {children}
      </div>
    </section>
  );
}

/* ---------- Hero (split layout, V1) ---------- */
export function Hero({
  eyebrow,
  title,
  lede,
  ctas,
  credentials,
  artifact,
}: {
  eyebrow: string;
  title: string;
  lede: ReactNode;
  ctas?: ReactNode;
  credentials?: ReactNode;
  /** The framed evidence artifact filling the right half (a <Terminal/>). */
  artifact?: ReactNode;
}) {
  return (
    <section className="cs-section cs-section--flush">
      <div className="cs-container cs-hero">
        <div>
          <span className="cs-eyebrow">{eyebrow}</span>
          <h1 className="cs-display" style={{ marginTop: "var(--cs-space-5)" }}>
            {title}
          </h1>
          <p
            className="cs-lede"
            style={{ marginTop: "var(--cs-space-5)", maxWidth: "52ch" }}
          >
            {lede}
          </p>
          {ctas && <div className="cs-cta-row">{ctas}</div>}
          {credentials && (
            <div style={{ marginTop: "var(--cs-space-8)" }}>{credentials}</div>
          )}
        </div>
        {artifact && <div className="cs-hero__artifact">{artifact}</div>}
      </div>
    </section>
  );
}

/* ---------- Button / CTA ---------- */
export function Button({
  href,
  children,
  variant = "primary",
  external,
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "ghost";
  external?: boolean;
  className?: string;
}) {
  const cls = [
    "cs-btn",
    variant === "primary" ? "cs-btn--primary" : "cs-btn--ghost",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  if (external) {
    return (
      <a href={href} className={cls} rel="noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

/* ---------- Card ---------- */
export function Card({
  accent,
  interactive,
  className,
  children,
}: {
  accent?: boolean;
  interactive?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const cls = [
    "cs-card",
    accent ? "cs-card--accent" : "",
    interactive ? "cs-card--interactive" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return <div className={cls}>{children}</div>;
}

/* ---------- Terminal / CodeBlock (evidence, V2/V4) ---------- */
export function Terminal({
  label,
  status,
  children,
}: {
  label: string;
  /** A <StatusChip/> or text in the chrome bar. */
  status?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="cs-terminal">
      <div className="cs-terminal__bar">
        <span>{label}</span>
        {status}
      </div>
      <pre className="cs-terminal__body" aria-label={label}>
        {children}
      </pre>
    </div>
  );
}

export function CodeBlock({
  code,
  label,
  frame,
  status,
}: {
  /** String or tinted ReactNode (compose <span className="cs-tok-danger"> for load-bearing tokens). */
  code: ReactNode;
  label?: string;
  /** Wrap in terminal chrome. */
  frame?: boolean;
  status?: ReactNode;
}) {
  if (frame) {
    return (
      <Terminal label={label ?? "shell"} status={status}>
        {code}
      </Terminal>
    );
  }
  return (
    <pre className="cs-code" aria-label={label}>
      {code}
    </pre>
  );
}

/* ---------- StatusChip (glyph + label, never colour-alone) ---------- */
type ChipTone = "accent" | "success" | "muted";

export function StatusChip({
  label,
  tone = "muted",
  icon,
  dot,
}: {
  label: string;
  tone?: ChipTone;
  icon?: IconName;
  /** Show the leading status dot. */
  dot?: boolean;
}) {
  return (
    <span className={`cs-chip cs-chip--${tone}`}>
      {dot && <span className="cs-chip__dot" aria-hidden="true" />}
      {icon && <Icon name={icon} />}
      {label}
    </span>
  );
}

/* ---------- CredentialStrip (V7) ---------- */
export function CredentialStrip({
  items,
  note,
}: {
  items: readonly string[];
  note?: string;
}) {
  return (
    <div className="cs-credentials" aria-label="Compliance frameworks">
      {items.map((it, i) => (
        <span key={it} className="cs-credentials__item">
          {i > 0 && (
            <span className="cs-credentials__sep" aria-hidden="true">
              ·
            </span>
          )}
          {it}
        </span>
      ))}
      {note && (
        <span style={{ flexBasis: "100%", color: "var(--cs-fg-muted)" }}>
          {note}
        </span>
      )}
    </div>
  );
}

/* ---------- EditionCard (featured-lead hierarchy, V12) ---------- */
export function EditionCard({
  href,
  name,
  icon,
  status,
  line,
  lead,
  proof,
}: {
  href: string;
  name: string;
  icon: IconName;
  status: ReactNode;
  line: string;
  lead?: boolean;
  /** One-line mono proof artifact (V8). */
  proof?: string;
}) {
  return (
    <Link
      href={href}
      className={`cs-card cs-card--interactive ${lead ? "cs-card--accent cs-editions__lead" : ""}`}
      style={{ display: "block" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "var(--cs-space-3)",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--cs-space-3)",
          }}
        >
          <Icon name={icon} size="lg" />
          <span className="cs-card-title">{name}</span>
        </span>
        {status}
      </div>
      <p className="cs-muted" style={{ marginTop: "var(--cs-space-3)" }}>
        {line}
      </p>
      {proof && (
        <code
          className="mono"
          style={{
            display: "block",
            marginTop: "var(--cs-space-4)",
            fontSize: "var(--cs-text-xs)",
            color: "var(--cs-fg-muted)",
          }}
        >
          {proof}
        </code>
      )}
    </Link>
  );
}

/* ---------- SkuMatrix (V14 — editions × modules) ---------- */
export function SkuMatrix({
  columns,
  rows,
}: {
  columns: readonly string[];
  /** Each row: label + a cell per column (true = included, string = note/price). */
  rows: readonly {
    label: string;
    cells: readonly (boolean | string)[];
  }[];
}) {
  return (
    <div className="cs-matrix__wrap">
      <table className="cs-matrix">
        <thead>
          <tr>
            <th scope="col">Module</th>
            {columns.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row" style={{ fontWeight: "var(--cs-weight-medium)" }}>
                {r.label}
              </th>
              {r.cells.map((cell, i) =>
                typeof cell === "boolean" ? (
                  <td
                    key={i}
                    className={cell ? "cs-matrix__yes" : ""}
                    aria-label={cell ? "included" : "not included"}
                  >
                    {cell ? <Icon name="check" /> : "—"}
                  </td>
                ) : (
                  <td key={i} className="cs-matrix__price">
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
