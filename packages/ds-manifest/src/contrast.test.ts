import { describe, expect, test } from "bun:test";
import {
  darkTheme,
  functionalDark,
  functionalLight,
  lightTheme,
} from "@caisson/ui/tokens";
import { checkContrast, type ContrastTheme } from "./contrast";

describe("checkContrast — parity with @caisson/ui's own contrast gate", () => {
  test("the live dark theme has zero violations", () => {
    expect(checkContrast(darkTheme, functionalDark, "dark")).toEqual([]);
  });

  test("the live light theme has zero violations", () => {
    expect(checkContrast(lightTheme, functionalLight, "light")).toEqual([]);
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
});
