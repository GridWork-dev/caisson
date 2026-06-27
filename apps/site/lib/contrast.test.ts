import { describe, expect, test } from "bun:test";

import { contrast } from "./contrast";

// The locked --cs-* token values (ADR-0042, packages/ui/styles/tokens.css). Verify every
// text/UI pair the site actually paints clears WCAG 2.2 AA: body text >= 4.5:1, large/UI >= 3:1.
const DARK = {
  bg: "oklch(0.16 0.012 220)",
  surface1: "oklch(0.20 0.013 220)",
  fg: "oklch(0.96 0.004 220)",
  fgMuted: "oklch(0.72 0.012 220)",
  accent: "oklch(0.74 0.115 205)",
  onAccent: "oklch(0.17 0.02 220)",
  link: "oklch(0.78 0.10 205)",
};

const LIGHT = {
  bg: "oklch(0.99 0.003 220)",
  surface1: "oklch(0.975 0.005 220)",
  fg: "oklch(0.22 0.015 220)",
  fgMuted: "oklch(0.45 0.018 220)",
  accent: "oklch(0.55 0.13 215)",
  onAccent: "oklch(0.99 0.01 220)",
  link: "oklch(0.50 0.13 215)",
};

describe("dark theme — WCAG AA", () => {
  test("body text on bg passes AA body", () => {
    expect(contrast(DARK.fg, DARK.bg).passesBody).toBe(true);
  });
  test("body text on surface-1 passes AA body", () => {
    expect(contrast(DARK.fg, DARK.surface1).passesBody).toBe(true);
  });
  test("muted text on bg passes AA body", () => {
    expect(contrast(DARK.fgMuted, DARK.bg).passesBody).toBe(true);
  });
  test("accent (UI/large) on bg passes AA large", () => {
    expect(contrast(DARK.accent, DARK.bg).passesLarge).toBe(true);
  });
  test("on-accent (button label) on accent passes AA body", () => {
    expect(contrast(DARK.onAccent, DARK.accent).passesBody).toBe(true);
  });
  test("link on bg passes AA large", () => {
    expect(contrast(DARK.link, DARK.bg).passesLarge).toBe(true);
  });
});

describe("light theme — WCAG AA", () => {
  test("body text on bg passes AA body", () => {
    expect(contrast(LIGHT.fg, LIGHT.bg).passesBody).toBe(true);
  });
  test("body text on surface-1 passes AA body", () => {
    expect(contrast(LIGHT.fg, LIGHT.surface1).passesBody).toBe(true);
  });
  test("muted text on bg passes AA body", () => {
    expect(contrast(LIGHT.fgMuted, LIGHT.bg).passesBody).toBe(true);
  });
  test("accent (UI/large) on bg passes AA large", () => {
    expect(contrast(LIGHT.accent, LIGHT.bg).passesLarge).toBe(true);
  });
  test("on-accent (button label) on accent passes AA body", () => {
    expect(contrast(LIGHT.onAccent, LIGHT.accent).passesBody).toBe(true);
  });
});
