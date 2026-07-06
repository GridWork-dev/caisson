// The audit-worm pilot composition (ADR-0263): append -> tamper-attempt -> verify-catches-it, the
// trusted-length-oracle story from packages/audit-worm/src/chain-store.ts (see
// apps/site/lib/module-pages.ts "audit-worm" record). One composition, one file — five scenes
// stacked with <Series> so each scene's useCurrentFrame() starts at its own local 0.
import {
  AbsoluteFill,
  interpolate,
  Series,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { durationMs, ease, enter } from "./motion";
import { color, font, radius } from "./tokens";

const BLOCK_COUNT = 5;
const TAMPER_INDEX = 2; // "block #3", 1-indexed in copy

const ORIGINAL_HASHES = [
  "a3f9d2e1c7b4",
  "58e2f0a91d3c",
  "0c7b41a3f9d2",
  "d91c3ae2f058",
  "f4b1c9a3e7d0",
];
const FORGED_HASH = "??????????";

/** The hairline-grid field every media placeholder on the site already uses (media-placeholder.tsx)
 *  — same motif, so the video reads as the same design system as the page it lives on. */
function GridBackground() {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: color.bg,
        backgroundImage: `repeating-linear-gradient(0deg, transparent 0 63px, ${color.border} 63px 64px), repeating-linear-gradient(90deg, transparent 0 63px, ${color.border} 63px 64px)`,
      }}
    />
  );
}

function Eyebrow({
  children,
  frame,
  fps,
  tone = "accent",
}: {
  children: string;
  frame: number;
  fps: number;
  tone?: "accent" | "danger";
}) {
  const style = enter({ frame, fps, durationMs: durationMs.base });
  return (
    <div
      style={{
        ...style,
        fontFamily: font.mono,
        fontSize: 28,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: tone === "danger" ? color.danger : color.accent,
        marginBottom: 24,
      }}
    >
      {children}
    </div>
  );
}

interface ChainRowProps {
  visibleCount: number;
  tampered: boolean;
  brokenLink: boolean;
  scanFraction?: number;
}

/** The shared chain-of-blocks visual reused across the append/tamper/verify scenes. */
function ChainRow({
  visibleCount,
  tampered,
  brokenLink,
  scanFraction,
}: ChainRowProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {Array.from({ length: BLOCK_COUNT }, (_, i) => {
        const shown = i < visibleCount;
        const isTampered = tampered && i === TAMPER_INDEX;
        const brokenAfter = brokenLink && i === TAMPER_INDEX;
        const scanHere =
          scanFraction !== undefined &&
          Math.abs(scanFraction - (i + 0.5) / BLOCK_COUNT) < 0.5 / BLOCK_COUNT;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                opacity: shown ? 1 : 0,
                width: 220,
                borderRadius: radius.lg,
                border: `2px solid ${isTampered ? color.danger : scanHere ? color.accent : color.border}`,
                background: color.surface2,
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div
                style={{
                  fontFamily: font.mono,
                  fontSize: 18,
                  color: color.fgMuted,
                }}
              >
                block #{i + 1}
              </div>
              <div
                style={{
                  fontFamily: font.mono,
                  fontSize: 22,
                  color: isTampered ? color.danger : color.fg,
                }}
              >
                {isTampered ? FORGED_HASH : ORIGINAL_HASHES[i]}
              </div>
              {shown && (
                <div
                  style={{
                    alignSelf: "flex-start",
                    fontFamily: font.mono,
                    fontSize: 14,
                    color: color.accent,
                    border: `1px solid ${color.accent}`,
                    borderRadius: radius.pill,
                    padding: "4px 10px",
                  }}
                >
                  worm anchor
                </div>
              )}
            </div>
            {i < BLOCK_COUNT - 1 && (
              <div
                style={{
                  width: 48,
                  height: 2,
                  background: brokenAfter ? "transparent" : color.borderStrong,
                  position: "relative",
                }}
              >
                {brokenAfter && (
                  <span
                    style={{
                      position: "absolute",
                      top: -14,
                      left: 12,
                      color: color.danger,
                      fontSize: 28,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TitleScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const eyebrowStyle = enter({ frame, fps, durationMs: durationMs.base });
  const titleStyle = enter({
    frame,
    fps,
    delayMs: durationMs.base,
    durationMs: durationMs.slow,
    easing: ease.reveal,
  });
  const ruleWidth = interpolate(frame, [0, fps * 2], [0, 420], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease.out,
  });
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <div
        style={{
          ...eyebrowStyle,
          fontFamily: font.mono,
          fontSize: 28,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: color.accent,
        }}
      >
        audit chain + worm
      </div>
      <div
        style={{
          ...titleStyle,
          fontFamily: font.sans,
          fontSize: 72,
          fontWeight: 600,
          color: color.fg,
          margin: "24px 0",
          maxWidth: 1200,
        }}
      >
        Append-only. Tamper-evident.
      </div>
      <div
        style={{
          width: ruleWidth,
          height: 2,
          background: color.accent,
        }}
      />
    </AbsoluteFill>
  );
}

function AppendScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const step = fps * 2.3;
  const visibleCount = Math.min(
    BLOCK_COUNT,
    Math.max(0, Math.floor((frame - fps * 0.6) / step) + 1),
  );
  const counterStyle = enter({ frame, fps, durationMs: durationMs.fast });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <Eyebrow frame={frame} fps={fps}>
        append()
      </Eyebrow>
      <ChainRow
        visibleCount={visibleCount}
        tampered={false}
        brokenLink={false}
      />
      <div
        style={{
          ...counterStyle,
          marginTop: 32,
          fontFamily: font.mono,
          fontSize: 22,
          color: color.fgMuted,
        }}
      >
        chain length: {visibleCount}
      </div>
    </AbsoluteFill>
  );
}

function TamperScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rowStyle = enter({ frame, fps, durationMs: durationMs.fast });
  const tampered = frame > fps * 2;
  const brokenLink = frame > fps * 3.6;
  const shakeAmplitude = interpolate(
    frame,
    [fps * 2, fps * 2 + 18, fps * 2 + 36],
    [0, 6, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease.out },
  );
  const labelStyle = enter({
    frame,
    fps,
    delayMs: 2000,
    durationMs: durationMs.base,
  });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <Eyebrow frame={frame} fps={fps} tone="danger">
        tamper-attempt()
      </Eyebrow>
      <div
        style={{ ...rowStyle, transform: `translateX(${shakeAmplitude}px)` }}
      >
        <ChainRow
          visibleCount={BLOCK_COUNT}
          tampered={tampered}
          brokenLink={brokenLink}
        />
      </div>
      {tampered && (
        <div
          style={{
            ...labelStyle,
            marginTop: 32,
            fontFamily: font.mono,
            fontSize: 22,
            color: color.danger,
          }}
        >
          rewrite attempt: block #{TAMPER_INDEX + 1}
        </div>
      )}
    </AbsoluteFill>
  );
}

function VerifyScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scanDurationFrames = fps * 3;
  const scanFraction = interpolate(frame, [0, scanDurationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease.out,
  });
  const reachedTamper = scanFraction >= (TAMPER_INDEX + 0.5) / BLOCK_COUNT;
  const resultDelayFrames = scanDurationFrames + 6;
  const resultStyle = enter({
    frame: frame - resultDelayFrames,
    fps,
    durationMs: durationMs.slow,
    easing: ease.reveal,
    distancePx: 16,
  });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <Eyebrow frame={frame} fps={fps}>
        verify()
      </Eyebrow>
      <ChainRow
        visibleCount={BLOCK_COUNT}
        tampered={reachedTamper}
        brokenLink={reachedTamper}
        {...(frame < scanDurationFrames ? { scanFraction } : {})}
      />
      <div
        style={{
          marginTop: 16,
          fontFamily: font.mono,
          fontSize: 16,
          color: color.fgMuted,
        }}
      >
        the WORM anchor is the trusted length oracle
      </div>
      {frame >= resultDelayFrames && (
        <div
          style={{
            ...resultStyle,
            marginTop: 32,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              fontFamily: font.mono,
              fontSize: 32,
              fontWeight: 700,
              color: color.danger,
              border: `2px solid ${color.danger}`,
              borderRadius: radius.pill,
              padding: "10px 28px",
            }}
          >
            FAIL
          </div>
          <div
            style={{
              fontFamily: font.sans,
              fontSize: 20,
              color: color.fg,
            }}
          >
            chain invalid at block #{TAMPER_INDEX + 1}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
}

function ClosingScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const style = enter({ frame, fps, durationMs: durationMs.base });
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <div style={style}>
        <div
          style={{
            fontFamily: font.mono,
            fontSize: 40,
            color: color.fg,
          }}
        >
          caisson
        </div>
        <div
          style={{
            fontFamily: font.sans,
            fontSize: 22,
            color: color.fgMuted,
            marginTop: 12,
          }}
        >
          audit-worm — the evidentiary primitive
        </div>
      </div>
    </AbsoluteFill>
  );
}

export function AuditWormDemo() {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <GridBackground />
      <Series>
        <Series.Sequence durationInFrames={Math.round(fps * 5)}>
          <TitleScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={Math.round(fps * 13)}>
          <AppendScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={Math.round(fps * 8)}>
          <TamperScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={Math.round(fps * 8)}>
          <VerifyScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={Math.round(fps * 2)}>
          <ClosingScene />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
}
