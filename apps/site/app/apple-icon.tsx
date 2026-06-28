import { ImageResponse } from "next/og";

// Apple touch icon (180×180) — the waterline-over-chamber mark on a padded dark tile (ADR-0078
// §2). Build-time raster; satori can't read OKLCH, so the locked palette is mirrored as hex (the
// sanctioned build-image exception, same as opengraph-image.tsx).
export const dynamic = "force-static";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const C = {
  bg: "#0d1216",
  accent: "#43bcd0",
  fg: "#eef2f3",
  border: "#2a343a",
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
        <path
          d="M6 11h7"
          stroke={C.accent}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M19 11h7"
          stroke={C.accent}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M13 11q3 -2.5 6 0"
          stroke={C.accent}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M9 15v9h14v-9"
          stroke={C.fg}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </div>,
    { ...size },
  );
}
