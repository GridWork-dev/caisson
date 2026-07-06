// Motion helpers for Remotion compositions (ADR-0263), tokenized against
// packages/ui/src/tokens/foundation.ts `motion` (ADR-0078 §6): fast/base/slow 120/180/240ms,
// authored bezier curves, never the platform default `ease`. A UI micro-transition duration reads
// as instant on video, so every duration is scaled by one constant factor — the fast:base:slow
// ratio (2:3:4) is preserved exactly, never re-authored per scene.
import { Easing, interpolate } from "remotion";

const MS_SCALE = 8;

export const durationMs = {
  fast: 120 * MS_SCALE,
  base: 180 * MS_SCALE,
  slow: 240 * MS_SCALE,
} as const;

export function msToFrames(ms: number, fps: number): number {
  return Math.round((ms / 1000) * fps);
}

/** The two authored curves from foundation.ts — never Easing.linear or the CSS default `ease`. */
export const ease = {
  /** Standard enter/UI transitions. */
  out: Easing.bezier(0, 0, 0.2, 1),
  /** Scroll-reveal / hero — a softer settle. */
  reveal: Easing.bezier(0.23, 1, 0.32, 1),
} as const;

export interface EnterOptions {
  frame: number;
  fps: number;
  delayMs?: number;
  durationMs?: number;
  easing?: (input: number) => number;
  distancePx?: number;
}

/** Fade + translate-up entrance — transform/opacity-first (ADR-0078 §6), clamped so a frame
 *  before `delayMs` or after the duration never overshoots 0/1. */
export function enter({
  frame,
  fps,
  delayMs = 0,
  durationMs: durMs = durationMs.base,
  easing = ease.out,
  distancePx = 24,
}: EnterOptions): { opacity: number; transform: string } {
  const delayFrames = msToFrames(delayMs, fps);
  const durFrames = Math.max(1, msToFrames(durMs, fps));
  const t = interpolate(frame - delayFrames, [0, durFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });
  return {
    opacity: t,
    transform: `translateY(${(1 - t) * distancePx}px)`,
  };
}
