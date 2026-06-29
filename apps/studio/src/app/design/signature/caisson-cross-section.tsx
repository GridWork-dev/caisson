/**
 * Caisson cross-section — the signature diagram (ADR-0100 "hold" beat). Inline SVG, every colour a
 * var(--cs-*) token; static (the scroll-reveal is the parent <Reveal>; no looping motion). The
 * metaphor is load-bearing: the pressurized working chamber holds the tenant boundary while the cold
 * harbor water bears down, and the central shaft carries append-only evidence up to the surface.
 */
export function CaissonCrossSection() {
  // Evidence tiles rising up the shaft (the audit chain surfaced).
  const tiles = [232, 200, 168, 136, 104, 72];

  return (
    <svg
      viewBox="0 0 440 372"
      width="100%"
      role="img"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block", height: "auto" }}
    >
      <title>
        Caisson cross-section: a pressurized working chamber holds back cold
        harbor water while evidence rises up the central shaft.
      </title>
      <defs>
        <filter id="sig-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <pattern
          id="sig-water"
          width="16"
          height="13"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0 7 q4 -5 8 0 t8 0"
            fill="none"
            stroke="var(--cs-border)"
            strokeWidth="1"
            opacity="0.55"
          />
        </pattern>
        <pattern
          id="sig-bedrock"
          width="18"
          height="18"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0 18 L18 0 M-5 5 L5 -5 M13 23 L23 13"
            stroke="var(--cs-border)"
            strokeWidth="1"
            opacity="0.7"
          />
        </pattern>
      </defs>

      {/* Cold water, left + right of the structure, below the waterline. */}
      <g>
        <rect
          x="40"
          y="96"
          width="120"
          height="216"
          fill="var(--cs-surface-2)"
        />
        <rect
          x="280"
          y="96"
          width="120"
          height="216"
          fill="var(--cs-surface-2)"
        />
        <rect x="40" y="96" width="120" height="216" fill="url(#sig-water)" />
        <rect x="280" y="96" width="120" height="216" fill="url(#sig-water)" />
      </g>

      {/* Waterline — the untrusted edge. */}
      <line
        x1="24"
        y1="96"
        x2="416"
        y2="96"
        stroke="var(--cs-border-strong)"
        strokeWidth="1.5"
      />

      {/* Water-load arrows bearing on the chamber walls (pressure in). */}
      <g
        stroke="var(--cs-fg-muted)"
        strokeWidth="1.5"
        fill="none"
        opacity="0.7"
      >
        <path d="M120 270 l30 0 m-7 -5 l7 5 l-7 5" />
        <path d="M320 270 l-30 0 m7 -5 l-7 5 l7 5" />
      </g>

      {/* Central shaft (steel tube) carrying evidence to the surface. */}
      <rect
        x="196"
        y="40"
        width="48"
        height="212"
        fill="var(--cs-bg)"
        stroke="var(--cs-border-strong)"
        strokeWidth="2"
      />
      {/* Evidence tiles (the append-only audit chain) rising up the shaft. */}
      <g>
        {tiles.map((y, i) => (
          <rect
            key={y}
            x="206"
            y={y}
            width="28"
            height="20"
            rx="2"
            fill="var(--cs-surface-1)"
            stroke="var(--cs-accent)"
            strokeWidth="1.25"
            opacity={0.55 + i * 0.07}
          />
        ))}
      </g>

      {/* Working chamber — the sealed, pressurized tenant boundary. */}
      <rect
        x="150"
        y="252"
        width="140"
        height="60"
        rx="4"
        fill="var(--cs-surface-1)"
        stroke="var(--cs-border-strong)"
        strokeWidth="2"
      />
      {/* Instrument light — the gate, holding under load (glow + core). */}
      <circle
        cx="220"
        cy="284"
        r="14"
        fill="var(--cs-accent)"
        opacity="0.45"
        filter="url(#sig-glow)"
      />
      <circle cx="220" cy="284" r="5" fill="var(--cs-accent)" />

      {/* Cutting edge into the bedrock. */}
      <path
        d="M150 312 L290 312 L266 332 L174 332 Z"
        fill="var(--cs-bg)"
        stroke="var(--cs-border-strong)"
        strokeWidth="2"
      />

      {/* Bedrock — the foundation. */}
      <rect x="0" y="332" width="440" height="40" fill="url(#sig-bedrock)" />
      <line
        x1="0"
        y1="332"
        x2="440"
        y2="332"
        stroke="var(--cs-border-strong)"
        strokeWidth="1.5"
      />

      {/* Leader lines + labels (mono, muted). */}
      <g
        fill="var(--cs-fg-muted)"
        fontFamily="var(--cs-font-mono)"
        fontSize="11"
      >
        <g stroke="var(--cs-border-strong)" strokeWidth="1" opacity="0.85">
          <path d="M244 130 L300 130" fill="none" />
          <path d="M150 284 L126 284" fill="none" />
        </g>
        <text x="304" y="120">
          evidence shaft
        </text>
        <text x="304" y="134" fill="var(--cs-accent)">
          audit chain ↑
        </text>
        <text x="24" y="280">
          working chamber
        </text>
        <text x="24" y="294">
          tenant boundary
        </text>
        <text x="24" y="90">
          untrusted edge
        </text>
        <text x="252" y="288" fill="var(--cs-accent)">
          the gate holds
        </text>
        <text x="24" y="358">
          foundation · cutting edge
        </text>
      </g>
    </svg>
  );
}
