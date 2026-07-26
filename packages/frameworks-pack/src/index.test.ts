// src/index.test.ts — public export-surface regression pin. `loadVendoredNistControlIds` does
// I/O relative to its own module file and ENOENTs from a built dist/ tree (bare tsc ships no
// JSON copy) — it must stay a package-internal test/re-vendor-script helper, never part of the
// published barrel (SHIP-audit P2 fix, oscal-spine). This catches a future accidental re-widening.
import { describe, expect, test } from "bun:test";
import * as oscalSpine from "@caisson/oscal-spine";
import * as pkg from "./index.ts";

describe("public export surface — the vendored-catalog I/O helper stays out of the barrel", () => {
  test("loadVendoredNistControlIds is NOT exported from the package root", () => {
    expect("loadVendoredNistControlIds" in pkg).toBe(false);
  });

  test("the pure extractControlIds IS exported (no I/O, safe in every runtime)", () => {
    expect(typeof (pkg as Record<string, unknown>).extractControlIds).toBe(
      "function",
    );
  });

  test("the parent re-exports the whole OSCAL package surface unchanged", () => {
    expect(pkg.toOscalBundle).toBe(oscalSpine.toOscalBundle);
    expect(pkg.toOscalCatalog).toBe(oscalSpine.toOscalCatalog);
    expect(pkg.nist80053Crosswalk).toBe(oscalSpine.nist80053Crosswalk);
  });
});
