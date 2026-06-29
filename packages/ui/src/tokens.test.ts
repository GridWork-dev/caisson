import { describe, expect, test } from "bun:test";
import {
  accentCandidates,
  darkTheme,
  fonts,
  foundation,
  functional,
  lightTheme,
  selected,
  typeCandidates,
} from "./tokens/index";

describe("design token contract (ADR-0042)", () => {
  test("the foundation + semantic themes are populated", () => {
    expect(foundation).toBeDefined();
    expect(Object.keys(lightTheme).length).toBeGreaterThan(0);
    expect(Object.keys(darkTheme).length).toBeGreaterThan(0);
    expect(functional).toBeDefined();
  });

  test("the candidate sets the lock points into are non-empty", () => {
    expect(accentCandidates.length).toBeGreaterThan(0);
    expect(typeCandidates.length).toBeGreaterThan(0);
  });

  test("the locked selection is palette A + type Structural", () => {
    // ADR-0042: changing the pick changes `selected`; this test guards the lock.
    expect(selected.palette).toBe("a");
    expect(selected.type).toBe("2");
    expect(fonts.sans.length).toBeGreaterThan(0);
    expect(fonts.mono.length).toBeGreaterThan(0);
  });

  test("every palette carries a scrim in both modes (ADR-0100 F4)", () => {
    // The scrim token is required by the overlay primitives (dialog/drawer). Guard it on every
    // candidate so a future palette add can't ship without one.
    for (const c of accentCandidates) {
      expect(c.dark.scrim.length).toBeGreaterThan(0);
      expect(c.light.scrim.length).toBeGreaterThan(0);
    }
    expect(darkTheme.scrim.length).toBeGreaterThan(0);
    expect(lightTheme.scrim.length).toBeGreaterThan(0);
  });

  test("the rem breakpoint ladder is the canonical ascending set (ADR-0100 F4)", () => {
    // The single source of truth for every @media width; the breakpoint guard (ADR-0101) reads it.
    const bp = foundation.breakpoint;
    expect(Object.keys(bp)).toEqual(["xs", "sm", "md", "lg", "xl", "2xl"]);
    const rems = Object.values(bp).map((v) => Number.parseFloat(v));
    expect(rems).toEqual([30, 40, 48, 60, 72, 90]);
    // strictly ascending — a guard against an out-of-order rung
    for (let i = 1; i < rems.length; i++)
      expect(rems[i]).toBeGreaterThan(rems[i - 1]!);
    // every value is a rem unit
    for (const v of Object.values(bp)) expect(v.endsWith("rem")).toBe(true);
  });
});
