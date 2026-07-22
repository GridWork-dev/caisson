/**
 * Caisson mark candidates — HIGH-CRAFT explorations (operator pick, not auto-decided). Each keeps the
 * caisson identity (pressurized chamber · cold waterline · one instrument light holding under load),
 * executed with real figure-ground: a two-tone steel body (border-strong fill, a top bevel highlight,
 * a bottom shade), a glowing accent core, precise edges — NOT the 4-stroke outline of the shipped
 * glyph. Brand floor (ADR-0078): dark is the brand, a single teal light, accent ≤10%. Every colour a
 * var(--cs-*) token.
 *
 * Variants:
 *   app  — the rich app-icon / favicon / OG mark: dark field, two-tone steel, accent light + glow.
 *   ui   — in-product line reduction: transparent, steel = currentColor stroke, accent light kept.
 *   mono — strict-mono wordmark lockup: the line reduction with the light in currentColor too.
 */
import type { SVGProps } from "react";

export type MarkVariant = "app" | "ui" | "mono";

export interface MarkProps extends Omit<SVGProps<SVGSVGElement>, "ref"> {
  size?: number;
  variant?: MarkVariant;
  title?: string;
}

function a11y(title?: string) {
  return title
    ? ({ role: "img", "aria-label": title } as const)
    : ({ "aria-hidden": true } as const);
}

const STEEL = "var(--cs-border-strong)"; // 0.42 L — real metal presence on the 0.16 field
const WELL = "var(--cs-surface-2)"; // 0.25 L — a darker recess
const FIELD = "var(--cs-bg)";
const HI = "var(--cs-fg)"; // bevel highlight (used at low opacity)

// The accent light belongs to the app-icon / favicon variant ONLY. The in-product (ui) and mono
// marks stay monochrome — the accent never enters the in-product wordmark (ADR-0078 §2, DESIGN.md §1).
function light(v: MarkVariant) {
  return v === "app" ? "var(--cs-accent)" : "currentColor";
}

/* ──────────────────────────────────────────────────────────────────────────
 * Concept A — "Cross-section": the pneumatic caisson sunk past the waterline,
 * cutting edge biting bedrock, the working chamber a sealed void holding one light.
 * ────────────────────────────────────────────────────────────────────────── */
export function MarkCrossSection({
  size = 64,
  variant = "app",
  title,
  ...rest
}: MarkProps) {
  const filled = variant === "app";
  const lit = light(variant);
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      {...a11y(title)}
      {...rest}
    >
      <defs>
        <filter id="mk-a-glow" x="-90%" y="-90%" width="280%" height="280%">
          <feGaussianBlur stdDeviation="2.6" />
        </filter>
      </defs>
      {filled && (
        <rect x="0" y="0" width="64" height="64" rx="14" fill={FIELD} />
      )}

      {/* waterline — the cold untrusted edge the bell breaches */}
      <line
        x1="6"
        y1="23"
        x2="58"
        y2="23"
        stroke={filled ? "var(--cs-border)" : "currentColor"}
        strokeWidth="2"
        strokeLinecap="round"
        opacity={filled ? 1 : 0.65}
      />

      {/* caisson / diving-bell body — domed cap, walls flaring to an open skirt */}
      <path
        d="M20 49 L22 28 C22 15 42 15 42 28 L44 49"
        fill={filled ? STEEL : "none"}
        stroke={filled ? "none" : "currentColor"}
        strokeWidth={filled ? 0 : 2.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {filled && (
        <>
          {/* close the steel skirt at the rim for the fill, then carve the chamber */}
          <path d="M20 49 L44 49 L42 28 C42 15 22 15 22 28 Z" fill={STEEL} />
          {/* working chamber — the open void the light hangs in */}
          <path d="M26 49 L28 30 C28 21 36 21 36 30 L38 49 Z" fill={FIELD} />
          {/* dome bevel highlight */}
          <path
            d="M23 27 C23 16 41 16 41 27"
            fill="none"
            stroke={HI}
            strokeWidth="2"
            opacity="0.12"
          />
          {/* cutting-edge rim */}
          <path
            d="M20 49 L26 49 M38 49 L44 49"
            stroke={HI}
            strokeWidth="2"
            opacity="0.18"
            strokeLinecap="round"
          />
        </>
      )}

      {/* instrument light — glow + core, hung in the chamber */}
      <circle
        cx="32"
        cy="37"
        r="5"
        fill={lit}
        opacity="0.5"
        filter="url(#mk-a-glow)"
      />
      <circle cx="32" cy="37" r="2.8" fill={lit} />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Concept B — "Pressure vessel": the chamber head-on as a sealed steel port,
 * two-tone bevel for weight, a waterline seam across the crown, one glowing core.
 * ────────────────────────────────────────────────────────────────────────── */
export function MarkVessel({
  size = 64,
  variant = "app",
  title,
  ...rest
}: MarkProps) {
  const filled = variant === "app";
  const lit = light(variant);
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      {...a11y(title)}
      {...rest}
    >
      <defs>
        <filter id="mk-b-glow" x="-90%" y="-90%" width="280%" height="280%">
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
      </defs>
      {filled && (
        <rect x="0" y="0" width="64" height="64" rx="14" fill={FIELD} />
      )}

      {/* vessel body */}
      <rect
        x="12"
        y="12"
        width="40"
        height="40"
        rx="12"
        fill={filled ? STEEL : "none"}
        stroke={filled ? "none" : "currentColor"}
        strokeWidth={filled ? 0 : 2.6}
      />
      {filled && (
        <>
          {/* top bevel highlight */}
          <path
            d="M24 12 h16 a12 12 0 0 1 12 12 v2 H12 v-2 a12 12 0 0 1 12 -12 Z"
            fill={HI}
            opacity="0.10"
          />
          {/* bottom shade — turned-steel read */}
          <path
            d="M12 38 v2 a12 12 0 0 0 12 12 h16 a12 12 0 0 0 12 -12 v-2 Z"
            fill={FIELD}
            opacity="0.20"
          />
          {/* darker well the light sits in */}
          <circle cx="32" cy="33" r="12.5" fill={WELL} opacity="0.9" />
        </>
      )}

      {/* crown seam — the waterline groove */}
      <line
        x1="23"
        y1="20"
        x2="41"
        y2="20"
        stroke={filled ? FIELD : "currentColor"}
        strokeWidth={filled ? 1.8 : 2}
        strokeLinecap="round"
        opacity={filled ? 0.55 : 0.65}
      />

      {/* instrument core — glow, halo ring, light */}
      <circle
        cx="32"
        cy="33"
        r="9"
        fill={lit}
        opacity="0.4"
        filter="url(#mk-b-glow)"
      />
      <circle
        cx="32"
        cy="33"
        r="6.5"
        fill="none"
        stroke={lit}
        strokeWidth="1.8"
        opacity="0.5"
      />
      <circle cx="32" cy="33" r="3.2" fill={lit} />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Concept C — "Instrument": a steel iris, the one light at dead centre.
 * The most abstract / premium read — "a single instrument light holds under load."
 * ────────────────────────────────────────────────────────────────────────── */
export function MarkInstrument({
  size = 64,
  variant = "app",
  title,
  ...rest
}: MarkProps) {
  const filled = variant === "app";
  const lit = light(variant);
  const blades = [0, 60, 120, 180, 240, 300];
  const groove = (deg: number, r1: number, r2: number) => {
    const a = ((deg + 30) * Math.PI) / 180;
    return {
      x1: 32 + r1 * Math.cos(a),
      y1: 32 + r1 * Math.sin(a),
      x2: 32 + r2 * Math.cos(a),
      y2: 32 + r2 * Math.sin(a),
    };
  };
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      {...a11y(title)}
      {...rest}
    >
      <defs>
        <filter id="mk-c-glow" x="-90%" y="-90%" width="280%" height="280%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      {filled && (
        <rect x="0" y="0" width="64" height="64" rx="14" fill={FIELD} />
      )}

      {/* steel disk */}
      <circle
        cx="32"
        cy="32"
        r="20"
        fill={filled ? STEEL : "none"}
        stroke={filled ? "none" : "currentColor"}
        strokeWidth={filled ? 0 : 2.6}
      />
      {filled && (
        <path
          d="M32 12 a20 20 0 0 1 14 6 l-3 3 a16 16 0 0 0 -22 0 l-3 -3 a20 20 0 0 1 14 -6 Z"
          fill={HI}
          opacity="0.10"
        />
      )}

      {/* aperture well */}
      <circle
        cx="32"
        cy="32"
        r="12"
        fill={filled ? FIELD : "none"}
        stroke={filled ? "none" : "currentColor"}
        strokeWidth={filled ? 0 : 2}
      />

      {/* iris blades — grooves cut into the ring */}
      <g
        stroke={filled ? FIELD : "currentColor"}
        strokeWidth={filled ? 2 : 1.8}
        strokeLinecap="round"
        opacity={filled ? 0.85 : 0.5}
      >
        {blades.map((deg) => {
          const g = groove(deg, 12, 19.5);
          return <line key={deg} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} />;
        })}
      </g>

      {/* the one light */}
      <circle
        cx="32"
        cy="32"
        r="8"
        fill={lit}
        opacity="0.45"
        filter="url(#mk-c-glow)"
      />
      <circle cx="32" cy="32" r="4" fill={lit} />
    </svg>
  );
}

export const CONCEPTS = [
  {
    id: "cross-section",
    name: "Cross-section",
    blurb:
      "The caisson as a diving bell breaching the waterline: a domed steel cap, walls flaring to an open skirt, the working chamber holding one light. The literal metaphor, built. Richest at 32+.",
    Mark: MarkCrossSection,
  },
  {
    id: "vessel",
    name: "Pressure vessel",
    blurb:
      "The chamber head-on: a sealed steel port, two-tone bevel for weight, a waterline seam across the crown, one glowing core. The strongest silhouette at 16px.",
    Mark: MarkVessel,
  },
  {
    id: "instrument",
    name: "Instrument",
    blurb:
      "A steel iris, the one light at dead centre: the most abstract, premium read. “A single instrument light holds under load.”",
    Mark: MarkInstrument,
  },
] as const;
