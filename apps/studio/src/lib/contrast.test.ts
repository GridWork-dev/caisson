import { describe, expect, test } from "bun:test";
import { contrast, fmt } from "./contrast";

describe("WCAG contrast", () => {
  test("black on white is the maximum ~21:1 and passes both thresholds", () => {
    const r = contrast("#000000", "#ffffff");
    expect(Math.round(r.ratio)).toBe(21);
    expect(r.passesBody).toBe(true);
    expect(r.passesLarge).toBe(true);
  });

  test("white on white fails every threshold", () => {
    const r = contrast("#ffffff", "#ffffff");
    expect(r.ratio).toBeCloseTo(1, 1);
    expect(r.passesBody).toBe(false);
    expect(r.passesLarge).toBe(false);
  });

  test("fmt renders a 2-dp ratio", () => {
    expect(fmt(4.5)).toBe("4.50:1");
  });
});
