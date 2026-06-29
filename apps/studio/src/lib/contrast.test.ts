import { describe, expect, test } from "bun:test";

import { contrast, fmt } from "./contrast";

/**
 * Studio foundations read-out helper (the swatch contrast meters). This is the STUDIO-LOCAL display
 * utility — distinct from the kit's canonical WCAG matrix gate (@caisson/ui tokens-contrast.test.ts,
 * ADR-0101 #2), which is the deterministic gate over the token objects. This test just pins the
 * helper's thresholds + formatting so the gallery's meters stay truthful.
 */
describe("studio contrast read-out helper", () => {
  test("black on white is the maximal ratio and passes both thresholds", () => {
    const r = contrast("#000000", "#ffffff");
    expect(r.ratio).toBeGreaterThan(20);
    expect(r.passesBody).toBe(true);
    expect(r.passesLarge).toBe(true);
  });

  test("body (4.5:1) vs large (3:1) thresholds gate independently", () => {
    // A mid-grey on white lands between the large-text and body thresholds.
    const r = contrast("#949494", "#ffffff");
    expect(r.passesLarge).toBe(true);
    expect(r.passesBody).toBe(false);
  });

  test("identical colours have ratio 1 and pass nothing", () => {
    const r = contrast("#777777", "#777777");
    expect(r.ratio).toBeCloseTo(1, 5);
    expect(r.passesBody).toBe(false);
    expect(r.passesLarge).toBe(false);
  });

  test("fmt renders a 2-dp ratio with the :1 suffix", () => {
    expect(fmt(4.5)).toBe("4.50:1");
    expect(fmt(21)).toBe("21.00:1");
  });
});
