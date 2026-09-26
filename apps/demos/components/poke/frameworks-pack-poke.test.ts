// The frameworks-pack poke's checkable claims, now that it drives the REAL packages through
// their browser entries (ADR-0396) and the hand-ported mirror (frameworks-pack-logic.ts) is
// deleted:
//
//   1. The poke's client graph is browser-safe — a STATIC SOURCE-GRAPH WALK, never a build.
//   2. SAMPLE_FRAMEWORK is a SELECTION over the real soc2Tsc, not a copy — reference identity,
//      which deep-equality could never prove (a byte-perfect clone passes toEqual; it cannot
//      pass includes()). And the sample cannot silently shrink: an upstream control-id rename
//      makes the filter drop it and the count assertion fails — a check the deleted
//      field-for-field parity suite structurally could not make.
//   3. The clause lookup (legitimately poke-local presentation composition) behaves on the real
//      pack, and the OSCAL export is deterministic under the fixed clock/id seams.
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { nodeBuiltinTaint } from "@caisson-sh/testing/module-graph";
import { soc2Tsc } from "@caisson-sh/frameworks-pack/browser";

import {
  CUSTOM_CLAUSE_KEY,
  SAMPLE_CONTROL_IDS,
  SAMPLE_FRAMEWORK,
  SAMPLE_NOW,
  clauseKey,
  findControlsByClause,
  listClauses,
  makeCounterIds,
} from "./frameworks-pack-poke";
import { toOscalCatalog } from "@caisson-sh/oscal-spine/browser";

const WORKSPACE_ROOT = join(import.meta.dir, "../../../..");
const POKE_ENTRY = join(import.meta.dir, "frameworks-pack-poke.tsx");

describe("the poke's client graph is browser-safe (static source walk, NOT a build)", () => {
  const walk = nodeBuiltinTaint(POKE_ENTRY, { workspaceRoot: WORKSPACE_ROOT });

  test("no module reachable from the client entry imports a node builtin (transitive)", () => {
    expect(walk.offenders).toEqual([]);
    expect(walk.unresolved).toEqual([]);
  });

  test("the walk really crossed into both packages' browser entries", () => {
    expect(walk.files).toContain("packages/frameworks-pack/src/browser.ts");
    expect(walk.files).toContain("packages/oscal-spine/src/browser.ts");
    // …and never the node-only halves.
    expect(walk.files.some((f) => f.endsWith("evidence/oscal-export.ts"))).toBe(
      false,
    );
    expect(
      walk.files.some((f) => f.endsWith("vendor/nist-catalog-controls.ts")),
    ).toBe(false);
  });
});

describe("SAMPLE_FRAMEWORK is a selection over the real pack, never a copy", () => {
  test("every sampled control IS the real pack's object (reference identity)", () => {
    expect(
      SAMPLE_FRAMEWORK.controls.every((c) => soc2Tsc.controls.includes(c)),
    ).toBe(true);
  });

  test("the sample cannot silently shrink on an upstream control-id rename", () => {
    expect(SAMPLE_FRAMEWORK.controls).toHaveLength(SAMPLE_CONTROL_IDS.size);
  });

  test("it is a genuine subset, not the whole pack relabeled", () => {
    expect(SAMPLE_FRAMEWORK.controls.length).toBeLessThan(
      soc2Tsc.controls.length,
    );
  });
});

describe("clause lookup — poke-local composition over the real model", () => {
  test("SOC2-TSC CC6.1 maps to three controls", () => {
    const r = findControlsByClause(SAMPLE_FRAMEWORK, "SOC2-TSC", "CC6.1");
    expect(r.matches.map((c) => c.id).sort()).toEqual([
      "ACCESS-CONTROL.LOGICAL",
      "ACCESS-CONTROL.MFA",
      "DATA-PROTECTION.ENCRYPTION",
    ]);
  });

  test("HIPAA-Security 164.312(b) maps to exactly the immutable-log control", () => {
    const r = findControlsByClause(
      SAMPLE_FRAMEWORK,
      "HIPAA-Security",
      "164.312(b)",
    );
    expect(r.matches.map((c) => c.id)).toEqual(["AUDIT.IMMUTABLE-LOG"]);
  });

  test("an unmapped clause returns zero matches, and whitespace is trimmed", () => {
    expect(
      findControlsByClause(SAMPLE_FRAMEWORK, "SOC2-TSC", "CC9.9").matches,
    ).toHaveLength(0);
    const r = findControlsByClause(SAMPLE_FRAMEWORK, " SOC2-TSC ", " CC6.1 ");
    expect(r.clauseFramework).toBe("SOC2-TSC");
    expect(r.matches).toHaveLength(3);
  });

  test("an empty reference never matches", () => {
    expect(
      findControlsByClause(SAMPLE_FRAMEWORK, "SOC2-TSC", "").matches,
    ).toHaveLength(0);
  });

  test("listClauses enumerates distinct pairs with counts, none the custom sentinel", () => {
    const options = listClauses(SAMPLE_FRAMEWORK);
    expect(options.length).toBeGreaterThan(0);
    expect(new Set(options.map((o) => o.key)).size).toBe(options.length);
    expect(options.some((o) => o.key === CUSTOM_CLAUSE_KEY)).toBe(false);
    for (const o of options) {
      expect(o.key).toBe(clauseKey(o.framework, o.reference));
      expect(o.controlCount).toBeGreaterThan(0);
    }
  });
});

describe("the OSCAL export is deterministic under the fixed seams", () => {
  test("the same clause selection renders the same document twice, with the expected controls", () => {
    const matches = findControlsByClause(
      SAMPLE_FRAMEWORK,
      "SOC2-TSC",
      "CC6.1",
    ).matches;
    const render = () =>
      toOscalCatalog([{ ...SAMPLE_FRAMEWORK, controls: [...matches] }], {
        now: SAMPLE_NOW,
        newId: makeCounterIds(),
        title: "Caisson Canonical Control Catalog",
        version: SAMPLE_FRAMEWORK.version,
      });
    const a = render();
    const b = render();
    expect(a).toEqual(b);
    const json = JSON.stringify(a);
    for (const id of [
      "ACCESS-CONTROL.LOGICAL",
      "ACCESS-CONTROL.MFA",
      "DATA-PROTECTION.ENCRYPTION",
    ]) {
      expect(json).toContain(id);
    }
  });
});
