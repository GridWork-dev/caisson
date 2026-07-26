// Golden + real-package parity for the frameworks-pack poke's browser mirror
// (frameworks-pack-logic.ts). Two independent anchors: (1) oscal-spine's committed
// oscal-catalog.merged.json golden, and (2) the real `toOscalCatalog` +
// `soc2Tsc`/`hipaaSecurity`/`euAiAct` exports,
// imported here by relative path (apps/site declares neither @caisson/frameworks-pack nor
// @caisson/oscal-spine as a workspace dependency -- see frameworks-pack-logic.ts's header for
// why). Bun's test runtime is node-like, so the real packages' node:crypto imports resolve fine
// here even though they cannot reach a browser bundle.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  euAiAct,
  hipaaSecurity,
  soc2Tsc,
} from "../../../../packages/frameworks-pack/src/index.ts";
import { OSCAL_VERSION as PKG_OSCAL_VERSION } from "../../../../packages/oscal-spine/src/evidence/oscal-export.ts";
import { toOscalCatalog as pkgToOscalCatalog } from "../../../../packages/oscal-spine/src/evidence/oscal-catalog-export.ts";

import {
  CUSTOM_CLAUSE_KEY,
  OSCAL_VERSION,
  SAMPLE_FRAMEWORK,
  clauseKey,
  findControlsByClause,
  listClauses,
  makeCounterIds,
  toOscalCatalog,
} from "./frameworks-pack-logic";
import type { Framework, OscalCatalogDocument } from "./frameworks-pack-logic";

const NOW = new Date("2026-07-18T00:00:00.000Z");

function counterIds(): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  };
}

describe("OSCAL_VERSION -- parity with the real oscal-spine constant", () => {
  test("matches the real package's OSCAL_VERSION exactly", () => {
    expect(OSCAL_VERSION).toBe(PKG_OSCAL_VERSION);
    expect(OSCAL_VERSION).toBe("1.2.2");
  });
});

describe("SAMPLE_FRAMEWORK -- every embedded control matches the real soc2Tsc pack field-for-field", () => {
  const realById = new Map(soc2Tsc.controls.map((c) => [c.id, c]));

  test("every sample control id exists in the real pack", () => {
    for (const control of SAMPLE_FRAMEWORK.controls) {
      expect(realById.has(control.id)).toBe(true);
    }
  });

  test("title/family/statement/guidance/crosswalk are byte-identical to the real control", () => {
    for (const control of SAMPLE_FRAMEWORK.controls) {
      const real = realById.get(control.id);
      expect(real).toBeDefined();
      expect(control.title).toBe(real!.title);
      expect(control.family).toBe(real!.family);
      expect(control.statement).toBe(real!.statement);
      expect(control.guidance).toBe(real!.guidance);
      expect(control.crosswalk).toEqual(real!.crosswalk);
    }
  });

  test("the sample framework's own id/title/version/description match the real pack", () => {
    expect(SAMPLE_FRAMEWORK.id).toBe(soc2Tsc.id);
    expect(SAMPLE_FRAMEWORK.title).toBe(soc2Tsc.title);
    expect(SAMPLE_FRAMEWORK.version).toBe(soc2Tsc.version);
    expect(SAMPLE_FRAMEWORK.description).toBe(soc2Tsc.description);
  });

  test("is a genuine subset, not the full pack", () => {
    expect(SAMPLE_FRAMEWORK.controls.length).toBeLessThan(
      soc2Tsc.controls.length,
    );
    expect(SAMPLE_FRAMEWORK.controls.length).toBeGreaterThan(0);
  });
});

describe("listClauses / findControlsByClause -- clause-to-control lookup", () => {
  test("CC6.1 maps to all three controls that cite it in the sample", () => {
    const result = findControlsByClause(SAMPLE_FRAMEWORK, "SOC2-TSC", "CC6.1");
    expect(result.matches.map((c) => c.id).sort()).toEqual(
      [
        "ACCESS-CONTROL.LOGICAL",
        "ACCESS-CONTROL.MFA",
        "DATA-PROTECTION.ENCRYPTION",
      ].sort(),
    );
  });

  test("a HIPAA-Security clause resolves to its one control", () => {
    const result = findControlsByClause(
      SAMPLE_FRAMEWORK,
      "HIPAA-Security",
      "164.312(b)",
    );
    expect(result.matches.map((c) => c.id)).toEqual(["AUDIT.IMMUTABLE-LOG"]);
  });

  test("an unmapped clause resolves to zero controls (the deny path)", () => {
    const result = findControlsByClause(SAMPLE_FRAMEWORK, "SOC2-TSC", "CC9.9");
    expect(result.matches).toHaveLength(0);
  });

  test("whitespace around a typed reference is trimmed before lookup", () => {
    const result = findControlsByClause(
      SAMPLE_FRAMEWORK,
      "SOC2-TSC",
      "  CC6.5  ",
    );
    expect(result.matches.map((c) => c.id)).toEqual([
      "DATA-PROTECTION.DISPOSAL",
    ]);
  });

  test("a right framework, wrong reference misses (framework alone is not enough)", () => {
    const result = findControlsByClause(SAMPLE_FRAMEWORK, "SOC2-TSC", "");
    expect(result.matches).toHaveLength(0);
  });

  test("listClauses enumerates every distinct crosswalk pair with its control count", () => {
    const clauses = listClauses(SAMPLE_FRAMEWORK);
    const cc61 = clauses.find(
      (c) => c.framework === "SOC2-TSC" && c.reference === "CC6.1",
    );
    expect(cc61?.controlCount).toBe(3);
    expect(clauses.map((c) => c.key)).not.toContain(CUSTOM_CLAUSE_KEY);
    expect(new Set(clauses.map((c) => c.key)).size).toBe(clauses.length);
  });

  test("clauseKey round-trips into a listClauses entry's key", () => {
    const clauses = listClauses(SAMPLE_FRAMEWORK);
    const first = clauses[0]!;
    expect(clauseKey(first.framework, first.reference)).toBe(first.key);
  });
});

describe("toOscalCatalog -- real-package parity (oscal-spine's toOscalCatalog)", () => {
  test("a single-pack export matches the real function byte-for-byte", () => {
    const mine = toOscalCatalog([soc2Tsc], {
      now: NOW,
      newId: counterIds(),
      title: "t",
      version: "v",
    });
    const real = pkgToOscalCatalog([soc2Tsc], {
      now: NOW,
      newId: counterIds(),
      title: "t",
      version: "v",
    });
    expect(mine).toEqual(real);
  });

  test("the merged three-pack catalog matches the committed oscal-spine golden fixture", () => {
    const ALL_PACKS: readonly Framework[] = [soc2Tsc, hipaaSecurity, euAiAct];
    const doc = toOscalCatalog(ALL_PACKS, {
      now: NOW,
      newId: counterIds(),
      title: "Caisson Canonical Control Catalog",
      version: "2026.1",
    });
    const golden = JSON.parse(
      readFileSync(
        join(
          import.meta.dir,
          "../../../../packages/oscal-spine/src/__golden__/oscal-catalog.merged.json",
        ),
        "utf8",
      ),
    ) as OscalCatalogDocument;
    expect(doc).toEqual(golden);
  });

  test("dedups a control shared verbatim across packs (AUDIT.IMMUTABLE-LOG) to one entry", () => {
    const ALL_PACKS: readonly Framework[] = [soc2Tsc, hipaaSecurity, euAiAct];
    const doc = toOscalCatalog(ALL_PACKS, {
      now: NOW,
      newId: counterIds(),
      title: "t",
      version: "v",
    });
    const hits = doc.catalog.groups.flatMap((g) =>
      g.controls.filter((c) => c.id === "AUDIT.IMMUTABLE-LOG"),
    );
    expect(hits).toHaveLength(1);
  });

  test("fails closed on an invalid clock", () => {
    expect(() =>
      toOscalCatalog([SAMPLE_FRAMEWORK], {
        now: new Date(Number.NaN),
        title: "t",
        version: "v",
      }),
    ).toThrow();
  });

  test("a clause-mapped synthetic export is deterministic across two identical calls", () => {
    const synthetic: Framework = {
      ...SAMPLE_FRAMEWORK,
      controls: findControlsByClause(SAMPLE_FRAMEWORK, "SOC2-TSC", "CC6.1")
        .matches,
    };
    const a = toOscalCatalog([synthetic], {
      now: NOW,
      newId: makeCounterIds(),
      title: "t",
      version: "v",
    });
    const b = toOscalCatalog([synthetic], {
      now: NOW,
      newId: makeCounterIds(),
      title: "t",
      version: "v",
    });
    expect(a).toEqual(b);
    expect(
      a.catalog.groups
        .flatMap((g) => g.controls)
        .map((c) => c.id)
        .sort(),
    ).toEqual(
      [
        "ACCESS-CONTROL.LOGICAL",
        "ACCESS-CONTROL.MFA",
        "DATA-PROTECTION.ENCRYPTION",
      ].sort(),
    );
  });
});
