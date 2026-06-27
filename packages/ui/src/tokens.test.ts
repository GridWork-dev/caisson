import { describe, expect, test } from "bun:test";
import { dark, light, themes } from "./index.ts";

// Reduce an object to its key structure (leaves → their typeof) for shape comparison.
function shape(value: unknown): unknown {
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = shape((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return typeof value;
}

describe("token contract", () => {
  test("light and dark share an identical shape (the contract)", () => {
    expect(shape(light)).toEqual(shape(dark));
  });

  test("themes map exposes both names", () => {
    expect(Object.keys(themes).sort()).toEqual(["dark", "light"]);
    expect(themes.dark).toBe(dark);
  });

  test("every token leaf is a non-empty string", () => {
    const leaves: string[] = [];
    const walk = (v: unknown): void => {
      if (typeof v === "string") leaves.push(v);
      else if (v && typeof v === "object")
        for (const x of Object.values(v as Record<string, unknown>)) walk(x);
    };
    walk(dark);
    expect(leaves.length).toBeGreaterThan(0);
    expect(leaves.every((s) => s.length > 0)).toBe(true);
  });
});
