import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const alt = "Caisson Agentic-Dev — a governed-agent kernel";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Build-time raster (satori) — hex mirrors the locked palette (ADR-0042/ADR-0078).
// Sanctioned exception to the "no hard-coded hex" rule; DOM still uses --cs-* tokens.
const C = {
  bg: "#0d1216", // --cs-bg
  surface: "#141b20", // --cs-surface-1
  fg: "#eef2f3", // --cs-fg
  muted: "#a4b0b6", // --cs-fg-muted
  accent: "#43bcd0", // --cs-accent (cold-steel teal)
  border: "#2a343a", // --cs-border
  dim: "#1e2a31", // --cs-surface-2 (dark band)
};

export default function AgenticDevOpengraphImage() {
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
      {/* Top — wordmark + module-family label */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontSize: 34, color: C.fg, fontWeight: 600 }}>
          caisson
        </span>
        <span
          style={{
            fontSize: 16,
            color: C.accent,
            background: C.dim,
            padding: "4px 12px",
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          Agentic-Dev
        </span>
      </div>

      {/* Body — waterline bar + headline */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Waterline motif */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ width: 64, height: 4, background: C.accent }} />
          <div
            style={{ width: 24, height: 4, background: C.accent, opacity: 0.4 }}
          />
          <div
            style={{ width: 12, height: 4, background: C.accent, opacity: 0.2 }}
          />
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 72,
            fontWeight: 600,
            letterSpacing: -2,
            lineHeight: 1.08,
          }}
        >
          <span>A governed-agent</span>
          <span>kernel.</span>
        </div>
        <div style={{ fontSize: 24, color: C.muted, maxWidth: 680 }}>
          Typed schema · lifecycle state machine · local hybrid memory · hooks
          dispatcher
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          color: C.muted,
          fontSize: 20,
          borderTop: `1px solid ${C.border}`,
          paddingTop: 28,
        }}
      >
        <span>
          A module family on the audited Caisson base · own the source
        </span>
        <span style={{ background: C.surface, padding: "8px 16px" }}>
          caisson.sh/agentic-dev
        </span>
      </div>
    </div>,
    { ...size },
  );
}
