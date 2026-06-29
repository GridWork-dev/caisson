import { ImageResponse } from "next/og";

// Apple touch icon (180×180) — the "Pressure vessel" mark (ADR-0103) on a padded dark tile: a
// sealed steel port holding one instrument light. Build-time raster; satori can't read OKLCH (or
// SVG filters), so the locked palette is mirrored as hex and the glow is a solid halo ring.
export const dynamic = "force-static";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const C = {
  bg: "#0d1216",
  accent: "#43bcd0",
  steel: "#2b353b",
  steelEdge: "#3a454b",
  well: "#11181c",
};

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: C.bg,
      }}
    >
      <svg width="120" height="120" viewBox="0 0 32 32" fill="none">
        {/* vessel body (steel) */}
        <rect
          x="6"
          y="6"
          width="20"
          height="20"
          rx="6"
          fill={C.steel}
          stroke={C.steelEdge}
        />
        {/* darker well */}
        <circle cx="16" cy="16.5" r="6.4" fill={C.well} />
        {/* crown seam */}
        <path
          d="M11 10.6h10"
          stroke={C.bg}
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.7"
        />
        {/* instrument light — halo ring + core (no blur; satori has no SVG filters) */}
        <circle
          cx="16"
          cy="16.5"
          r="3.3"
          fill="none"
          stroke={C.accent}
          strokeWidth="1"
          strokeOpacity="0.55"
        />
        <circle cx="16" cy="16.5" r="1.7" fill={C.accent} />
      </svg>
    </div>,
    { ...size },
  );
}
