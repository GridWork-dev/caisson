import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const alt =
  "Caisson — Compliance-grade infrastructure for regulated SaaS";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Build-time raster (satori) — it cannot read CSS custom properties or OKLCH, so the locked
// palette is mirrored as concrete hex HERE ONLY. This is the one sanctioned exception to the
// "no hard-coded hex" rule (ADR-0042 governs the rendered DOM, not a build-time image).
const C = {
  bg: "#0d1216", // --cs-bg
  surface: "#141b20", // --cs-surface-1
  fg: "#eef2f3", // --cs-fg
  muted: "#a4b0b6", // --cs-fg-muted
  accent: "#43bcd0", // --cs-accent (cold-steel teal)
  border: "#2a343a", // --cs-border
};

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: C.bg,
        color: C.fg,
        padding: 80,
        fontFamily: "monospace",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontSize: 34, color: C.fg }}>caisson</span>
        <span style={{ fontSize: 20, color: C.muted }}>
          compliance-grade infrastructure
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ width: 64, height: 4, background: C.accent }} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 88,
            fontWeight: 600,
            letterSpacing: -2,
            lineHeight: 1.05,
          }}
        >
          <span>Fail-closed by</span>
          <span>construction.</span>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          color: C.muted,
          fontSize: 22,
          borderTop: `1px solid ${C.border}`,
          paddingTop: 28,
        }}
      >
        <span>Fail-closed RLS · S3 WORM · append-only audit chain</span>
        <span style={{ background: C.surface, padding: "8px 16px" }}>
          caisson.sh
        </span>
      </div>
    </div>,
    { ...size },
  );
}
