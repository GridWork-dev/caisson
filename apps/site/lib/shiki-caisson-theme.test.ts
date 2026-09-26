import { describe, expect, test } from "bun:test";
import { clampRgb, formatHex, parse, toGamut } from "culori";

import {
  codeTokensDark,
  codeTokensLight,
  darkTheme,
  lightTheme,
} from "@caisson-sh/ui/tokens";

import { caissonDark, caissonLight } from "./shiki-caisson-theme";

// Drift guard (ADR-0374 audit round 2, F9): shiki-caisson-theme.ts bakes hand-derived hex
// literals of --cs-* OKLCH tokens with no code-level link back to the token source, so a palette
// edit in packages/ui silently stops matching what's actually painted. Per the file's own header
// comment, each hex is "the gamut-mapped sRGB hex of a --cs-* OKLCH token" -- same CSS Color 4
// toGamut('rgb','oklch') method the packages/ui contrast gate uses (tokens-contrast.test.ts),
// NOT the naive per-channel clampRgb (the two disagree on at least one of these tokens: light
// codeString clamps to #007650 but toGamut's #007253 is what's actually baked).
const hexCss4 = (c: string) => formatHex(toGamut("rgb", "oklch")(parse(c)!));
const hexClamp = (c: string) => formatHex(clampRgb(parse(c)!));

function foregroundFor(
  theme: typeof caissonLight | typeof caissonDark,
  scopeMarker: string,
): string {
  const entry = theme.settings.find((s) => {
    const scopes = Array.isArray(s.scope) ? s.scope : [s.scope];
    return scopes.some((sc) => sc?.startsWith(scopeMarker));
  });
  const fg = entry?.settings.foreground;
  if (!fg)
    throw new Error(`shiki-caisson-theme: no foreground for "${scopeMarker}"`);
  return fg;
}

describe("caissonLight/caissonDark baked hexes match their --cs-* OKLCH token (toGamut derivation)", () => {
  test("light: editor.foreground == lightTheme.fg", () => {
    expect(caissonLight.colors["editor.foreground"]).toBe(
      hexCss4(lightTheme.fg),
    );
  });
  test("light: comment foreground == lightTheme.fgMuted", () => {
    expect(foregroundFor(caissonLight, "comment")).toBe(
      hexCss4(lightTheme.fgMuted),
    );
  });
  test("light: string foreground == codeTokensLight.codeString", () => {
    expect(foregroundFor(caissonLight, "string")).toBe(
      hexCss4(codeTokensLight.codeString),
    );
  });
  test("light: keyword foreground == codeTokensLight.codeKeyword", () => {
    expect(foregroundFor(caissonLight, "keyword")).toBe(
      hexCss4(codeTokensLight.codeKeyword),
    );
  });

  test("dark: editor.foreground == darkTheme.fg", () => {
    expect(caissonDark.colors["editor.foreground"]).toBe(hexCss4(darkTheme.fg));
  });
  test("dark: comment foreground == darkTheme.fgMuted", () => {
    expect(foregroundFor(caissonDark, "comment")).toBe(
      hexCss4(darkTheme.fgMuted),
    );
  });
  test("dark: string foreground == codeTokensDark.codeString", () => {
    expect(foregroundFor(caissonDark, "string")).toBe(
      hexCss4(codeTokensDark.codeString),
    );
  });
  test("dark: keyword foreground == codeTokensDark.codeKeyword", () => {
    expect(foregroundFor(caissonDark, "keyword")).toBe(
      hexCss4(codeTokensDark.codeKeyword),
    );
  });

  // Documents the exact disagreement case named in the header comment above -- not itself a
  // guard, just proof the two methods really do diverge here (else this would be a vacuous test
  // suite that could never fail on a naive-clamp regression).
  test("toGamut and clampRgb disagree on light codeString (why the method must be pinned)", () => {
    expect(hexCss4(codeTokensLight.codeString)).not.toBe(
      hexClamp(codeTokensLight.codeString),
    );
  });
});
