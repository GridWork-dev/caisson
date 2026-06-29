import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { foundation } from "./tokens/foundation";

/**
 * Breakpoint guard — ADR-0099 gate #5. Every `@media` WIDTH in the kit's CSS must be a rung on the
 * ADR-0098 rem ladder (`foundation.breakpoint`, the single source of truth). Media queries can't read
 * CSS custom properties, so a width is a raw literal that silently drifts off the ladder; this test
 * is the deterministic gate that keeps every breakpoint snapped to a named rung.
 *
 * Scope: width media features only (`min-width`/`max-width`). Non-width features the ladder doesn't
 * govern — `prefers-color-scheme`, `prefers-reduced-motion`, `forced-colors` — are ignored.
 */

const KIT_DIRS = [
  join(import.meta.dir, "..", "styles"),
  join(import.meta.dir, "components"),
];

/** The allowed width set, derived from the ladder (rem AND the px-equivalent, in case a value is
 * authored in px). Pulling from `foundation.breakpoint` means a ladder edit updates the guard too. */
const ladderRems = Object.values(foundation.breakpoint); // ["30rem", … ,"90rem"]
const ALLOWED = new Set<string>();
for (const rem of ladderRems) {
  const n = Number.parseFloat(rem); // "48rem" → 48
  ALLOWED.add(`${n}rem`);
  ALLOWED.add(`${n * 16}px`); // rem→px at the 16px root, the only sanctioned px form
}

/** Every `(min-width: …)` / `(max-width: …)` occurrence across the kit's stylesheets. */
function collectWidths(): { file: string; raw: string }[] {
  const widthRe = /\((?:min|max)-width:\s*([^)]+)\)/g;
  const hits: { file: string; raw: string }[] = [];
  for (const dir of KIT_DIRS) {
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".css")) continue;
      const css = readFileSync(join(dir, name), "utf8");
      for (const m of css.matchAll(widthRe))
        hits.push({ file: name, raw: m[1].trim() });
    }
  }
  return hits;
}

describe("breakpoint guard — every @media width is a ladder rung (ADR-0099 gate #5)", () => {
  const widths = collectWidths();

  test("the kit declares at least one width breakpoint (guard is live, not vacuously green)", () => {
    expect(widths.length).toBeGreaterThan(0);
  });

  for (const { file, raw } of widths) {
    test(`${file}: ${raw} is on the ADR-0098 ladder`, () => {
      expect([...ALLOWED]).toContain(raw);
    });
  }
});
