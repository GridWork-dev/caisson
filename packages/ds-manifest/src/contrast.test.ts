import { describe, expect, test } from "bun:test";
import {
  checkContrast,
  type ContrastCode,
  type ContrastFunctional,
  type ContrastTheme,
} from "./contrast";

const darkTheme: ContrastTheme = {
  bg: "#000000",
  surface1: "#000000",
  surface2: "#000000",
  border: "#777777",
  borderStrong: "#ffffff",
  fg: "#ffffff",
  fgMuted: "#ffffff",
  accent: "#ffffff",
  accentHover: "#ffffff",
  onAccent: "#000000",
  accentTint: "#000000",
  focus: "#ffffff",
  link: "#ffffff",
  glowAccent: "#000000",
  scrim: "#000000",
};
const lightTheme: ContrastTheme = {
  ...darkTheme,
  bg: "#ffffff",
  surface1: "#ffffff",
  surface2: "#ffffff",
  fg: "#000000",
  fgMuted: "#000000",
  accent: "#000000",
  accentHover: "#000000",
  onAccent: "#ffffff",
  accentTint: "#ffffff",
  focus: "#000000",
  link: "#000000",
};
const functionalDark: ContrastFunctional = {
  success: "#ffffff",
  warning: "#ffffff",
  danger: "#ffffff",
  info: "#ffffff",
};
const functionalLight: ContrastFunctional = {
  success: "#000000",
  warning: "#000000",
  danger: "#000000",
  info: "#000000",
};
const codeTokensDark: ContrastCode = {
  codeString: "#ffffff",
  codeKeyword: "#ffffff",
};
const codeTokensLight: ContrastCode = {
  codeString: "#000000",
  codeKeyword: "#000000",
};

describe("checkContrast — shared browser-rendered matrix", () => {
  test("an accessible dark palette has zero violations", () => {
    expect(
      checkContrast(darkTheme, functionalDark, "dark", codeTokensDark),
    ).toEqual([]);
  });

  test("an accessible light palette has zero violations", () => {
    expect(
      checkContrast(lightTheme, functionalLight, "light", codeTokensLight),
    ).toEqual([]);
  });

  test("flags a real low-contrast pair (fg collapsed onto bg)", () => {
    const flattened: ContrastTheme = { ...darkTheme, fg: darkTheme.bg };
    const violations = checkContrast(flattened, functionalDark, "dark");
    expect(violations.length).toBeGreaterThan(0);
    expect(
      violations.some((v) => v.fg === "fg" && v.bg === "bg" && v.ratio < v.min),
    ).toBe(true);
  });

  test("flags a functional/status token collapsed onto its surface", () => {
    const flatFn = { ...functionalDark, success: darkTheme.bg };
    const violations = checkContrast(darkTheme, flatFn, "dark");
    expect(violations.some((v) => v.fg === "success" && v.bg === "bg")).toBe(
      true,
    );
  });

  test("flags a code-syntax token collapsed onto its surface", () => {
    const flatCode = { ...codeTokensDark, codeString: darkTheme.bg };
    const violations = checkContrast(
      darkTheme,
      functionalDark,
      "dark",
      flatCode,
    );
    expect(violations.some((v) => v.fg === "codeString" && v.bg === "bg")).toBe(
      true,
    );
  });

  test("uses the stricter browser-equivalent gamut mapping", () => {
    const preFixLight = {
      ...lightTheme,
      accent: "oklch(0.50 0.13 215)",
      accentTint: "oklch(0.93 0.03 205)",
    };
    const violations = checkContrast(
      preFixLight,
      functionalLight,
      "light",
      codeTokensLight,
    );

    expect(
      violations.some(
        (v) => v.fg === "accent" && v.bg === "accentTint" && v.ratio < 4.5,
      ),
    ).toBe(true);
  });

  test("fails closed instead of discarding alpha from checked colors", () => {
    expect(() =>
      checkContrast(
        {
          ...darkTheme,
          fg: "rgb(255 255 255 / 10%)",
        },
        functionalDark,
        "dark",
        codeTokensDark,
      ),
    ).toThrow("checked contrast colors must be opaque");
  });
});
