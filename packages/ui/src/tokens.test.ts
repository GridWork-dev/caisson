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
});
